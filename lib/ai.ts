import fs from "node:fs";
import path from "node:path";
import { findCachedAnswer, saveAnswerForJob } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import type { AnswerRequest, AnswerResult, OutreachMessage } from "@/lib/types";

const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
const modelAliases: Record<string, string> = {
  "gpt-5.5-min": "openai/gpt-5-mini",
  "gpt-5.5-mini": "openai/gpt-5-mini",
  "gpt-5-mini": "openai/gpt-5-mini",
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function readPrompt(name: string) {
  return fs.readFileSync(path.join(process.cwd(), "prompts", name), "utf8");
}

function getOpenRouterModel() {
  const configured = process.env.OPENROUTER_MODEL ?? "openai/gpt-5-mini";
  return modelAliases[configured] ?? configured;
}

export function classifyQuestion(question: string) {
  const text = question.toLowerCase();

  if (
    text.includes("salary") ||
    text.includes("ctc") ||
    text.includes("compensation")
  ) {
    return "salary";
  }

  if (
    text.includes("why") &&
    (text.includes("company") || text.includes("join"))
  ) {
    return "why_company";
  }

  if (text.includes("leave") || text.includes("leaving")) {
    return "why_leaving";
  }

  if (text.includes("cover letter")) {
    return "cover_letter";
  }

  if (
    text.includes("5 year") ||
    text.includes("five year") ||
    text.includes("career goal")
  ) {
    return "career_goal";
  }

  if (text.includes("notice")) {
    return "notice_period";
  }

  return "general";
}

export function extractKeywords(text = "") {
  const ignored = new Set([
    "with",
    "and",
    "the",
    "for",
    "you",
    "are",
    "this",
    "that",
    "from",
    "have",
    "will",
    "your",
    "our",
    "job",
    "role",
  ]);

  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9+#. ]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !ignored.has(word)),
    ),
  ).slice(0, 12);
}

function fallbackAnswer(input: AnswerRequest) {
  const profile = getProfile();
  const category = classifyQuestion(input.question);

  if (category === "salary") {
    return "My expected compensation is 12–18 LPA, depending on the scope, ownership, and overall fit for the role.";
  }

  if (category === "why_leaving") {
    return profile.narratives.whyLeftPreviousCompany;
  }

  if (category === "career_goal") {
    return profile.narratives.careerGoal;
  }

  if (category === "notice_period") {
    return profile.noticePeriod;
  }

  const evidence =
    "I have shipped AI voice agents handling 200+ daily calls, built RAG systems with Azure AI Search, and owned full-stack SaaS work across Next.js, Node.js, TypeScript, Python, Redis, Docker, and Azure.";

  if (category === "why_company") {
    return `I am interested in ${input.company} because the ${input.role} role looks like a strong fit for the kind of practical AI and product engineering I have been doing. ${evidence}`;
  }

  if (category === "cover_letter") {
    return `Hi ${input.company} team, I am excited about the ${input.role} role. ${evidence} I am high-agency, comfortable with ambiguity, and used to working close to customers from discovery to production.`;
  }

  return `For the ${input.role} role at ${input.company}, the strongest overlap is my experience building production AI and full-stack systems. ${evidence}`;
}

export function enforceSalaryGuardrail(answer: string, category: string) {
  if (category !== "salary") {
    return answer;
  }

  const normalized = answer.replace(/12\s*[–-]\s*18\s*LPA/gi, "12–18 LPA");
  if (normalized.includes("12–18 LPA")) {
    return normalized;
  }

  return "My expected compensation is 12–18 LPA, depending on role scope and overall fit.";
}

async function callOpenRouter(messages: ChatMessage[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch(openRouterUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Hunt For Me",
    },
    body: JSON.stringify({
      model: getOpenRouterModel(),
      messages,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function generateAnswer(
  input: AnswerRequest,
): Promise<AnswerResult> {
  if (!input.company.trim()) {
    throw new Error("Company name is required");
  }

  const category = classifyQuestion(input.question);
  const keywords = extractKeywords(input.jdText);
  const cachedAnswer = findCachedAnswer({
    company: input.company,
    title: input.role,
    question: input.question,
  });

  if (cachedAnswer) {
    const guardedCachedAnswer = enforceSalaryGuardrail(cachedAnswer, category);
    if (guardedCachedAnswer !== cachedAnswer) {
      saveAnswerForJob({
        company: input.company,
        title: input.role,
        question: input.question,
        answer: guardedCachedAnswer,
        url: input.jobUrl,
        jdText: input.jdText,
      });
    }

    return {
      category,
      answer: guardedCachedAnswer,
      matchedKeywords: keywords.filter((keyword) =>
        guardedCachedAnswer.toLowerCase().includes(keyword.toLowerCase()),
      ),
      cached: true,
    };
  }

  const profile = getProfile();
  const prompt = readPrompt("application-answer.md");
  const userPrompt = JSON.stringify(
    {
      question: input.question,
      company: input.company,
      role: input.role,
      jdText: input.jdText ?? "",
      category,
      candidate: profile,
    },
    null,
    2,
  );

  let answer: string | null = null;
  try {
    answer = await callOpenRouter([
      { role: "system", content: prompt },
      { role: "user", content: userPrompt },
    ]);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
  }

  answer ??= fallbackAnswer(input);

  answer = enforceSalaryGuardrail(answer, category);

  const matchedKeywords = keywords.filter((keyword) =>
    answer.toLowerCase().includes(keyword.toLowerCase()),
  );

  saveAnswerForJob({
    company: input.company,
    title: input.role,
    question: input.question,
    answer,
    url: input.jobUrl,
    jdText: input.jdText,
  });

  return {
    category,
    answer,
    matchedKeywords,
    cached: false,
  };
}

export async function generateOutreach(input: {
  name: string;
  title: string;
  company: string;
  channel: OutreachMessage["channel"];
  companyContext?: string;
}) {
  const profile = getProfile();
  const prompt = readPrompt("outreach-message.md");
  const userPrompt = JSON.stringify({ ...input, candidate: profile }, null, 2);

  let body: string | null = null;
  try {
    body = await callOpenRouter([
      { role: "system", content: prompt },
      { role: "user", content: userPrompt },
    ]);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
  }

  body ??= `Hi ${input.name}, noticed ${input.company}${input.companyContext ? ` - ${input.companyContext}` : ""}. I build AI and full-stack systems fast, from customer discovery to production. Open to a quick chat if ${input.title} or founder-led engineering roles are relevant.`;

  if (input.channel === "linkedin_note" && body.length > 280) {
    body = `${body.slice(0, 277).trimEnd()}...`;
  }

  return body.replace(/12\s*[–-]\s*18\s*LPA/gi, "").trim();
}
