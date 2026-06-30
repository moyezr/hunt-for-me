const baseUrl = process.env.HFM_BASE_URL ?? "http://localhost:3000";

export {};

type ApiResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

async function readJson<T>(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON from ${response.url}, got: ${text}`);
  }
}

async function api<T>(
  path: string,
  init?: RequestInit,
  expectedStatus?: number,
) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (expectedStatus && response.status !== expectedStatus) {
    throw new Error(
      `${path} returned ${response.status}, expected ${expectedStatus}`,
    );
  }

  const payload = await readJson<ApiResponse<T>>(response);
  if (!payload.ok) {
    throw new Error(`${path} failed: ${payload.error}`);
  }

  return payload.data;
}

async function apiFailure(
  path: string,
  init: RequestInit,
  expectedStatus: number,
) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = await readJson<ApiResponse<never>>(response);

  if (response.status !== expectedStatus || payload.ok) {
    throw new Error(
      `${path} expected failure ${expectedStatus}, got ${response.status}`,
    );
  }

  return payload.error;
}

async function text(path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  return response.text();
}

function postJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function patchJson(body: unknown): RequestInit {
  return {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

const suffix = Date.now();

await api<{ status: string }>("/api/health");

const homeHtml = await text("/");
if (
  !homeHtml.includes("Today") ||
  !homeHtml.includes("Top application queue")
) {
  throw new Error("Home page did not render the daily operating cockpit");
}

await apiFailure(
  "/api/answer",
  postJson({
    question: "Why do you want to join us?",
    role: "Applied AI Engineer",
  }),
  400,
);

const salary = await api<{ answer: string }>(
  "/api/answer",
  postJson({
    question: "Expected CTC",
    company: `Runtime Smoke ${suffix}`,
    role: "Applied AI Engineer",
  }),
);
if (!salary.answer.includes("12–18 LPA")) {
  throw new Error("Salary guardrail did not return 12–18 LPA");
}

const specificityCompany = `Runtime Specificity ${suffix}`;
const specificityRole = "Forward Deployed AI Engineer";
const specificity = await api<{ answer: string; category: string }>(
  "/api/answer",
  postJson({
    question: "Why are you looking for a new role?",
    company: specificityCompany,
    role: specificityRole,
    jdText: "Customer-facing AI engineering with TypeScript and RAG.",
  }),
);
if (
  specificity.category !== "why_looking" ||
  !specificity.answer.includes(specificityCompany) ||
  !specificity.answer.includes(specificityRole)
) {
  throw new Error("Specificity guardrail did not include company and role");
}

const batchAnswers = await api<{
  answers: { id: string; answer: string; category: string }[];
}>(
  "/api/answers",
  postJson({
    questions: [
      { id: "name", question: "Full name" },
      { id: "salary", question: "Expected CTC" },
    ],
    company: `Runtime Smoke ${suffix}`,
    role: "Applied AI Engineer",
  }),
);
if (
  batchAnswers.answers.length !== 2 ||
  batchAnswers.answers[0].answer !== "Moyez Rabbani" ||
  !batchAnswers.answers[1].answer.includes("12–18 LPA")
) {
  throw new Error("Batch answers did not preserve order and guardrails");
}

await apiFailure(
  "/api/answers",
  postJson({
    questions: Array.from({ length: 21 }, (_, index) => ({
      id: `question_${index}`,
      question: `Question ${index + 1}`,
    })),
    company: `Runtime Smoke ${suffix}`,
    role: "Applied AI Engineer",
  }),
  400,
);

const resume = await api<{
  resume: { filename: string; exists: boolean };
}>(
  "/api/resumes/recommend",
  postJson({
    role: "Forward Deployed Engineer",
    jdText: "Customer-facing AI engineering with TypeScript and Python.",
  }),
);
if (resume.resume.filename !== "Forward_Deployed_Engineer.pdf") {
  throw new Error(
    `Unexpected resume recommendation: ${resume.resume.filename}`,
  );
}
if (!resume.resume.exists) {
  throw new Error(`Recommended resume is missing: ${resume.resume.filename}`);
}

const createdJob = await api<{
  job: { id: string; status: string; appliedAt: string | null };
}>(
  "/api/jobs",
  postJson({
    title: `Runtime Smoke Engineer ${suffix}`,
    company: `Runtime Smoke Co ${suffix}`,
    url: `https://example.com/jobs/${suffix}`,
    platform: "runtime",
    jdText: "Need Next.js, TypeScript, RAG, Redis, Docker, and Azure.",
  }),
  201,
);
if (!createdJob.job.id.startsWith("job_")) {
  throw new Error(`Unexpected job id: ${createdJob.job.id}`);
}

await apiFailure(
  "/api/jobs",
  postJson({
    title: `Runtime Invalid Fit ${suffix}`,
    company: `Runtime Invalid Fit Co ${suffix}`,
    url: `https://example.com/jobs/invalid-fit-${suffix}`,
    platform: "runtime",
    fitScore: 11,
  }),
  400,
);

const appliedJob = await api<{
  job: { id: string; status: string; appliedAt: string | null };
}>(`/api/jobs/${createdJob.job.id}`, patchJson({ status: "applied" }));
if (appliedJob.job.status !== "applied" || !appliedJob.job.appliedAt) {
  throw new Error("Job was not marked applied");
}

await apiFailure(
  "/api/scrape",
  postJson({
    query: "AI Engineer",
    location: "India Remote",
    platforms: ["linkedin"],
  }),
  400,
);

await apiFailure(
  `/api/jobs/${createdJob.job.id}`,
  patchJson({ status: "submitted" }),
  400,
);

await apiFailure(
  "/api/jobs",
  postJson({
    title: `Runtime Smoke Engineer ${suffix}`,
    company: `Runtime Smoke Co ${suffix}`,
    url: `https://example.com/jobs/${suffix}`,
    platform: "runtime",
  }),
  409,
);

const csv = [
  "name,title,company,platform,profile_url,notes",
  `Runtime Founder ${suffix},Founder,Runtime Outreach ${suffix},linkedin,https://linkedin.com/in/runtime-${suffix},building agentic hiring workflows`,
].join("\n");
const imported = await api<{
  contacts: { id: string; status: string; messageHistory: unknown[] }[];
}>("/api/contacts/import", postJson({ csv }));
const contact = imported.contacts[0];
if (!contact.id.startsWith("con_") || contact.status !== "new") {
  throw new Error("Contact import did not create a new contact");
}

const duplicateImport = await api<{
  contacts: { id: string; status: string; messageHistory: unknown[] }[];
}>("/api/contacts/import", postJson({ csv }));
if (duplicateImport.contacts[0].id !== contact.id) {
  throw new Error(
    "Duplicate contact import did not reuse the existing contact",
  );
}

const drafted = await api<{
  contact: { id: string; status: string; messageHistory: unknown[] };
  message: { body: string };
}>(
  `/api/contacts/${contact.id}/message`,
  postJson({ channel: "linkedin_note" }),
);
if (
  drafted.contact.id !== contact.id ||
  drafted.contact.status !== "drafted" ||
  drafted.contact.messageHistory.length < 1
) {
  throw new Error("Existing contact draft was not appended");
}
if (/12\s*[–-]\s*18\s*LPA/i.test(drafted.message.body)) {
  throw new Error("Outreach message mentioned salary");
}
if (!drafted.message.body.includes("building agentic hiring workflows")) {
  throw new Error("Outreach message did not include imported company context");
}

await apiFailure(
  `/api/contacts/${contact.id}/message`,
  postJson({ channel: "sms" }),
  400,
);

const duplicateDraft = await api<{
  contact: { id: string; status: string; messageHistory: unknown[] };
  message: { body: string };
}>(
  "/api/message",
  postJson({
    name: `Runtime Founder ${suffix}`,
    title: "Founder",
    company: `Runtime Outreach ${suffix}`,
    platform: "linkedin",
    profileUrl: `https://linkedin.com/in/runtime-${suffix}`,
    channel: "linkedin_note",
    companyContext: "building agentic hiring workflows",
  }),
);
if (duplicateDraft.contact.id !== contact.id) {
  throw new Error(
    "Duplicate outreach draft did not reuse the existing contact",
  );
}
if (
  !duplicateDraft.message.body.includes("building agentic hiring workflows")
) {
  throw new Error("Duplicate outreach draft did not include company context");
}

const batchDrafts = await api<{
  drafts: {
    index: number;
    contact: {
      id: string;
      platform: string;
      status: string;
      messageHistory: unknown[];
    };
    message: { body: string };
  }[];
}>(
  "/api/messages",
  postJson({
    channel: "linkedin_note",
    contacts: [
      {
        id: contact.id,
        companyContext: "expanding hiring automation",
      },
      {
        name: `Runtime Recruiter ${suffix}`,
        title: "Recruiter",
        company: `Runtime Batch ${suffix}`,
        companyContext: "hiring AI engineers",
        platform: "linkedin",
        profileUrl: `https://linkedin.com/in/runtime-batch-${suffix}`,
      },
    ],
  }),
);
if (
  batchDrafts.drafts.length !== 2 ||
  batchDrafts.drafts[0].contact.id !== contact.id ||
  !batchDrafts.drafts[1].contact.id.startsWith("con_")
) {
  throw new Error(
    "Batch outreach drafts did not handle existing and new contacts",
  );
}
if (
  batchDrafts.drafts.some((item) =>
    /12\s*[–-]\s*18\s*LPA/i.test(item.message.body),
  )
) {
  throw new Error("Batch outreach draft mentioned salary");
}
if (
  !batchDrafts.drafts[0].message.body.includes("expanding hiring automation") ||
  !batchDrafts.drafts[1].message.body.includes("hiring AI engineers")
) {
  throw new Error("Batch outreach drafts did not include company context");
}

const emailDrafts = await api<{
  drafts: {
    contact: { id: string; platform: string; messageHistory: unknown[] };
    message: { body: string };
  }[];
}>(
  "/api/messages",
  postJson({
    channel: "email",
    contacts: [
      {
        name: `Runtime Email Contact ${suffix}`,
        title: "Founder",
        company: `Runtime Email ${suffix}`,
        companyContext: "building B2B automation",
      },
    ],
  }),
);
if (
  emailDrafts.drafts.length !== 1 ||
  emailDrafts.drafts[0].contact.platform !== "email"
) {
  throw new Error("Email outreach drafts did not default to email platform");
}

await apiFailure(
  "/api/messages",
  postJson({
    channel: "linkedin_note",
    contacts: Array.from({ length: 21 }, (_, index) => ({
      name: `Runtime Batch Contact ${suffix}-${index}`,
      title: "Recruiter",
      company: `Runtime Batch Cap ${suffix}`,
    })),
  }),
  400,
);

const templates = await api<{
  config: { channels: { linkedin_note: { maxChars: number } } };
}>("/api/outreach/templates");
if (templates.config.channels.linkedin_note.maxChars !== 280) {
  throw new Error("LinkedIn note template max length is not configured");
}

const jobsCsv = await text("/api/export/jobs");
if (!jobsCsv.includes(createdJob.job.id)) {
  throw new Error("Jobs CSV did not include runtime job");
}

const contactsCsv = await text("/api/export/contacts");
if (!contactsCsv.includes(contact.id)) {
  throw new Error("Contacts CSV did not include runtime contact");
}

const outreachHtml = await text("/outreach");
if (
  !outreachHtml.includes("Follow-ups due") ||
  !outreachHtml.includes("Load follow-ups due") ||
  !outreachHtml.includes("Contact status")
) {
  throw new Error("Outreach page did not render follow-up queue controls");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      jobId: createdJob.job.id,
      contactId: contact.id,
    },
    null,
    2,
  ),
);
