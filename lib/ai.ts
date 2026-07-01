import fs from "node:fs";
import path from "node:path";
import { findCachedAnswer, saveAnswerForJob } from "@/lib/db";
import {
  buildOutreachPrompt,
  getOutreachTemplate,
} from "@/lib/outreach-templates";
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

export function getApplicationPrompt(category: string) {
  const base = readPrompt("application-answer.md");
  const safeCategory = category.replace(/[^a-z0-9_-]/gi, "");
  const categoryPath = path.join(
    process.cwd(),
    "prompts",
    `application-${safeCategory}.md`,
  );

  if (!safeCategory || !fs.existsSync(categoryPath)) {
    return base;
  }

  return `${base}\n\nCategory-specific instructions:\n${fs.readFileSync(
    categoryPath,
    "utf8",
  )}`;
}

export function getOpenRouterModel() {
  const configured = process.env.OPENROUTER_MODEL ?? "gpt-5.5-min";
  return modelAliases[configured] ?? configured;
}

export function heuristicJobScore(jdText: string) {
  const profile = getProfile();
  const text = jdText.toLowerCase();
  const matched = profile.skills.filter((skill) =>
    text.includes(skill.toLowerCase()),
  );
  const roleMatched = profile.preferredRoles.some((role) =>
    text.includes(role.toLowerCase()),
  );
  const aiRoleMatched = /\b(ai|llm|rag|agent|applied ai)\b/i.test(jdText);
  const score = Math.min(
    10,
    Math.max(
      1,
      Math.ceil(matched.length / 1.5) +
        (roleMatched ? 4 : 0) +
        (aiRoleMatched ? 2 : 0),
    ),
  );

  return {
    score,
    matchedSkills: matched,
  };
}

function parseScore(value: string | null) {
  if (!value) {
    return null;
  }

  const jsonMatch = value.match(/\{[\s\S]*\}/);
  const raw = jsonMatch?.[0] ?? value;

  try {
    const parsed = JSON.parse(raw) as { score?: unknown };
    const score =
      typeof parsed.score === "number" ? parsed.score : Number(parsed.score);
    if (Number.isFinite(score)) {
      return Math.min(10, Math.max(1, Math.round(score)));
    }
  } catch {
    const numeric = Number(value.match(/\b([1-9]|10)\b/)?.[1]);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

export function classifyQuestion(question: string) {
  const text = question.toLowerCase();
  const compact = text.replace(/[^a-z0-9]/g, "");

  if (extractQuestionOptions(question).length > 0) {
    return "option_choice";
  }

  if (
    text.includes("full name") ||
    text === "name" ||
    compact === "fullname" ||
    compact === "candidateName".toLowerCase()
  ) {
    return "full_name";
  }

  if (text.includes("email") || text.includes("e-mail")) {
    return "email";
  }

  if (
    text.includes("phone") ||
    text.includes("mobile") ||
    text.includes("contact number")
  ) {
    return "phone";
  }

  if (text.includes("linkedin")) {
    return "linkedin";
  }

  if (text.includes("github") || text.includes("git hub")) {
    return "github";
  }

  if (
    text.includes("portfolio") ||
    text.includes("website") ||
    text.includes("personal site")
  ) {
    return "website";
  }

  if (
    text.includes("current location") ||
    text.includes("preferred location") ||
    text.includes("location preference")
  ) {
    return "location";
  }

  if (
    text.includes("current company") ||
    text.includes("current employer") ||
    text.includes("present company") ||
    text.includes("present employer")
  ) {
    return "current_company";
  }

  if (
    text.includes("current designation") ||
    text.includes("current job title") ||
    text.includes("current role") ||
    text.includes("present designation") ||
    text.includes("present role")
  ) {
    return "current_title";
  }

  if (
    (text.includes("year") ||
      text.includes("yrs") ||
      text.includes("y.o.e") ||
      text.includes("yoe")) &&
    (text.includes("experience") ||
      text.includes("exp") ||
      text.includes("worked"))
  ) {
    return "experience_years";
  }

  if (
    text.includes("education") ||
    text.includes("qualification") ||
    text.includes("degree") ||
    text.includes("college") ||
    text.includes("university")
  ) {
    return "education";
  }

  if (
    text.includes("salary") ||
    text.includes("ctc") ||
    text.includes("compensation")
  ) {
    return "salary";
  }

  if (
    text.includes("i confirm") ||
    text.includes("i certify") ||
    text.includes("i agree") ||
    text.includes("i authorize") ||
    text.includes("i consent") ||
    text.includes("terms and conditions") ||
    text.includes("details are accurate") ||
    text.includes("information is accurate")
  ) {
    return "confirmation";
  }

  if (
    text.includes("why") &&
    (text.includes("company") || text.includes("join"))
  ) {
    return "why_company";
  }

  if (
    text.includes("why are you looking") ||
    text.includes("why you're looking") ||
    text.includes("why you are looking") ||
    text.includes("reason for looking") ||
    text.includes("looking for a change") ||
    text.includes("job change") ||
    text.includes("role change")
  ) {
    return "why_looking";
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

  if (
    text.includes("notice") ||
    text.includes("when can you start") ||
    text.includes("when can you join") ||
    text.includes("joining date") ||
    text.includes("available to start")
  ) {
    return "notice_period";
  }

  return "general";
}

export function extractQuestionOptions(question: string) {
  const match = question.match(/(?:^|\n)options:\s*(.+)$/i);
  if (!match) {
    return [];
  }

  return Array.from(
    new Set(
      match[1]
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean)
        .filter((option) => !/^select\b/i.test(option)),
    ),
  );
}

export function deterministicOptionAnswer(question: string) {
  const options = extractQuestionOptions(question);
  if (options.length === 0) {
    return null;
  }

  const text = question.toLowerCase();
  const pick = (patterns: RegExp[]) =>
    patterns
      .map((pattern) =>
        options.find((option) => pattern.test(option.toLowerCase())),
      )
      .find(Boolean);

  if (
    text.includes("work mode") ||
    text.includes("work location") ||
    text.includes("preferred location") ||
    text.includes("remote")
  ) {
    return pick([/\bremote\b/, /\bhybrid\b/]) ?? options[0];
  }

  if (
    text.includes("relocate") ||
    text.includes("relocation") ||
    text.includes("open to moving") ||
    text.includes("willing to move")
  ) {
    return pick([/\byes\b/, /\bopen\b/, /\bwilling\b/, /\btrue\b/]) ?? "Yes";
  }

  if (text.includes("interview")) {
    return pick([/\bvideo\b/, /\bphone\b/]) ?? options[0];
  }

  if (
    text.includes("sponsor") ||
    text.includes("sponsorship") ||
    text.includes("visa")
  ) {
    return pick([/\bno\b/, /not required/, /do not/]) ?? "No";
  }

  if (
    text.includes("authorized to work") ||
    text.includes("authorised to work") ||
    text.includes("eligible to work") ||
    text.includes("right to work") ||
    text.includes("work permit")
  ) {
    return pick([/\byes\b/, /\btrue\b/]) ?? "Yes";
  }

  if (
    text.includes("confirm") ||
    text.includes("agree") ||
    text.includes("consent") ||
    text.includes("accurate")
  ) {
    return pick([/\byes\b/, /\bagree\b/, /\btrue\b/]) ?? "Yes";
  }

  return options[0];
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

export function extractProfileSkillKeywords(jdText = "") {
  const text = jdText.toLowerCase();
  const profile = getProfile();

  return profile.skills
    .filter((skill) => text.includes(skill.toLowerCase()))
    .slice(0, 6);
}

export function enforceKeywordCoverage(answer: string, jdText = "") {
  const required = extractProfileSkillKeywords(jdText);
  const missing = required.filter(
    (keyword) => !answer.toLowerCase().includes(keyword.toLowerCase()),
  );

  if (required.length === 0 || missing.length === 0) {
    return answer;
  }

  const selected = missing.slice(0, 4).join(", ");
  return `${answer} Relevant overlap includes ${selected}.`;
}

function parseProfileYearMonth(value: string) {
  const match = value.match(/^(\d{4})(?:-(\d{2}))?/);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2] ?? "01") - 1,
  };
}

function roundedProfileExperienceYears() {
  const profile = getProfile();
  const starts = profile.experience
    .map((item) => parseProfileYearMonth(item.start))
    .filter((item): item is { year: number; month: number } => item !== null)
    .sort((a, b) => a.year - b.year || a.month - b.month);
  const earliest = starts[0];
  if (!earliest) {
    return null;
  }

  const now = new Date();
  const elapsedMonths =
    (now.getFullYear() - earliest.year) * 12 + now.getMonth() - earliest.month;
  return String(Math.max(1, Math.round(elapsedMonths / 12)));
}

export function deterministicProfileAnswer(category: string) {
  const profile = getProfile();
  const currentExperience =
    profile.experience.find((item) => item.end.toLowerCase() === "present") ??
    profile.experience[0];

  switch (category) {
    case "full_name":
      return profile.name;
    case "email":
      return profile.contact.email;
    case "phone":
      return profile.contact.phone;
    case "linkedin":
      return profile.contact.linkedin;
    case "github":
      return profile.contact.github;
    case "website":
      return profile.contact.website;
    case "location":
      return profile.locationPreferences.join(", ");
    case "current_company":
      return currentExperience?.company ?? null;
    case "current_title":
      return currentExperience?.title ?? null;
    case "experience_years":
      return roundedProfileExperienceYears();
    case "education":
      return profile.education
        .map((item) =>
          [item.degree, item.field, item.institution]
            .filter(
              (part) =>
                part &&
                part !== "Not specified in current profile" &&
                !part.startsWith("Education details were not present"),
            )
            .join(", "),
        )
        .filter(Boolean)
        .join("; ");
    case "confirmation":
      return "Yes";
    case "notice_period":
      return profile.noticePeriod;
    default:
      return null;
  }
}

export function deterministicAnswerForQuestion(question: string) {
  const optionAnswer = deterministicOptionAnswer(question);
  if (optionAnswer) {
    return optionAnswer;
  }

  return deterministicProfileAnswer(classifyQuestion(question));
}

export function fallbackAnswer(input: AnswerRequest) {
  const profile = getProfile();
  const category = classifyQuestion(input.question);

  if (category === "salary") {
    return "My expected compensation is 12–18 LPA, depending on the scope, ownership, and overall fit for the role.";
  }

  if (category === "why_leaving") {
    return profile.narratives.whyLeftPreviousCompany;
  }

  if (category === "why_looking") {
    return profile.narratives.whyLooking;
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

export function enforceAnswerSpecificity({
  answer,
  company,
  role,
  category,
}: {
  answer: string;
  company: string;
  role: string;
  category: string;
}) {
  if (
    [
      "full_name",
      "email",
      "phone",
      "linkedin",
      "github",
      "website",
      "location",
      "current_company",
      "current_title",
      "experience_years",
      "education",
      "confirmation",
      "option_choice",
      "notice_period",
      "salary",
    ].includes(category)
  ) {
    return answer;
  }

  const lowerAnswer = answer.toLowerCase();
  const hasCompany = lowerAnswer.includes(company.toLowerCase());
  const hasRole = lowerAnswer.includes(role.toLowerCase());

  if (hasCompany && hasRole) {
    return answer;
  }

  const prefix = `For the ${role} role at ${company},`;
  if (!hasCompany && !hasRole) {
    return `${prefix} ${answer.charAt(0).toLowerCase()}${answer.slice(1)}`;
  }

  if (!hasCompany) {
    return `${answer} I would bring this specifically to ${company}.`;
  }

  return `${answer} This is the context I would bring to the ${role} role.`;
}

export function enforceOutreachSalaryGuardrail(message: string) {
  const salaryPattern =
    /\b(salary|ctc|compensation|lpa|package|pay|expected comp)\b|12\s*[–-]\s*18/i;
  const sentences = message.match(/[^.!?]+[.!?]?/g) ?? [message];
  const cleaned = sentences
    .filter((sentence) => !salaryPattern.test(sentence))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    cleaned ||
    "I build AI and full-stack systems fast, stay close to customers, and can get useful without much ramp."
  );
}

export function enforceOutreachSpecificity({
  body,
  company,
  companyContext,
}: {
  body: string;
  company: string;
  companyContext?: string;
}) {
  const anchor = (companyContext?.trim() || company.trim()).replace(
    /\s+/g,
    " ",
  );
  if (!anchor) {
    return body;
  }

  if (body.toLowerCase().includes(anchor.toLowerCase())) {
    return body;
  }

  const contextSentence = companyContext?.trim()
    ? `Noticed ${anchor}.`
    : `Noticed ${company}.`;
  const subject = body.match(/^(subject:[^\n]+)(\n+)([\s\S]*)/i);
  if (subject) {
    return `${subject[1]}${subject[2]}${contextSentence} ${subject[3]}`;
  }

  const greeting = body.match(/^(hi\s+[^,]+,\s*)/i);
  if (!greeting) {
    return `${contextSentence} ${body}`;
  }

  return `${greeting[0]}${contextSentence} ${body.slice(greeting[0].length)}`;
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

export function fallbackOutreachMessage(input: {
  name: string;
  title: string;
  company: string;
  channel: OutreachMessage["channel"];
  companyContext?: string;
}) {
  const profile = getProfile();
  const firstName = input.name.trim().split(/\s+/)[0] || input.name;
  const context = input.companyContext?.trim()
    ? `${input.companyContext.trim()} at ${input.company}`
    : input.company;
  const proofPoint =
    profile.outreachVoice.traits.find((trait) => trait.includes("500+")) ??
    profile.outreachVoice.traits[0] ??
    "high-agency";

  if (input.channel === "email") {
    return [
      `Subject: Hands-on AI/full-stack engineer for ${input.company}`,
      "",
      `Hi ${firstName},`,
      "",
      `I noticed ${context}. I build production AI voice agents, RAG systems, and full-stack SaaS workflows, and I am used to moving from customer discovery to shipped software quickly.`,
      "",
      `I am ${proofPoint}, build fast, and can get useful without much ramp. If ${input.company} is hiring for ${input.title} or similar hands-on engineering roles, would a quick chat make sense?`,
    ].join("\n");
  }

  return `Hi ${firstName}, noticed ${context}. I build AI and full-stack systems fast, ${proofPoint}, and can get useful without much ramp. Open to a quick chat if ${input.title} or hands-on engineering roles are relevant?`;
}

export async function generateJobFitScore({
  title,
  company,
  jdText,
}: {
  title: string;
  company: string;
  jdText: string;
}) {
  const fallback = heuristicJobScore(`${title} ${company} ${jdText}`);
  const profile = getProfile();

  try {
    const response = await callOpenRouter([
      {
        role: "system",
        content:
          "You score jobs for Moyez Rabbani. Return only compact JSON with a numeric score from 1 to 10. Score 6+ only when the role is a credible fit for his AI engineering, RAG, voice agents, full-stack SaaS, customer-facing ownership, and startup/founding engineer profile.",
      },
      {
        role: "user",
        content: JSON.stringify({
          candidate: {
            headline: profile.headline,
            preferredRoles: profile.preferredRoles,
            skills: profile.skills,
            locationPreferences: profile.locationPreferences,
          },
          job: {
            title,
            company,
            jdText: jdText.slice(0, 3500),
          },
          responseFormat: { score: "integer 1-10" },
        }),
      },
    ]);
    const score = parseScore(response);

    return {
      score: score ?? fallback.score,
      matchedSkills: fallback.matchedSkills,
      source: score === null ? "heuristic" : "ai",
    };
  } catch {
    return {
      ...fallback,
      source: "heuristic",
    };
  }
}

export async function generateAnswer(
  input: AnswerRequest,
): Promise<AnswerResult> {
  if (!input.company.trim()) {
    throw new Error("Company name is required");
  }

  const category = classifyQuestion(input.question);
  const keywords = extractKeywords(input.jdText);
  const deterministicAnswer = deterministicAnswerForQuestion(input.question);

  if (deterministicAnswer) {
    saveAnswerForJob({
      company: input.company,
      title: input.role,
      question: input.question,
      answer: deterministicAnswer,
      url: input.jobUrl,
      jdText: input.jdText,
    });

    return {
      category,
      answer: deterministicAnswer,
      matchedKeywords: [],
      cached: false,
    };
  }

  const cachedAnswer = findCachedAnswer({
    company: input.company,
    title: input.role,
    question: input.question,
  });

  if (cachedAnswer) {
    const guardedCachedAnswer = enforceKeywordCoverage(
      enforceAnswerSpecificity({
        answer: enforceSalaryGuardrail(cachedAnswer, category),
        company: input.company,
        role: input.role,
        category,
      }),
      input.jdText,
    );
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
  const prompt = getApplicationPrompt(category);
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

  answer = enforceKeywordCoverage(
    enforceAnswerSpecificity({
      answer: enforceSalaryGuardrail(answer, category),
      company: input.company,
      role: input.role,
      category,
    }),
    input.jdText,
  );

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
  const prompt = buildOutreachPrompt(input.channel);
  const template = getOutreachTemplate(input.channel);
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

  body ??= fallbackOutreachMessage(input);

  body = enforceOutreachSpecificity({
    body: enforceOutreachSalaryGuardrail(body),
    company: input.company,
    companyContext: input.companyContext,
  });

  if (template.maxChars && body.length > template.maxChars) {
    body = `${body.slice(0, template.maxChars - 3).trimEnd()}...`;
  }

  return body;
}
