import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { createId } from "@/lib/id";
import type {
  Contact,
  ContactStatus,
  Job,
  JobStatus,
  OutreachMessage,
} from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "jobhunt.db");

const schema = [
  `CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    url TEXT NOT NULL,
    platform TEXT NOT NULL,
    jd_text TEXT NOT NULL DEFAULT '',
    fit_score INTEGER,
    status TEXT NOT NULL DEFAULT 'discovered',
    answers TEXT NOT NULL DEFAULT '{}',
    applied_at TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(company, title)
  )`,
  `CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    platform TEXT NOT NULL,
    profile_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    message_history TEXT NOT NULL DEFAULT '[]',
    follow_up_date TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
];

type JobRow = {
  id: string;
  title: string;
  company: string;
  url: string;
  platform: string;
  jd_text: string;
  fit_score: number | null;
  status: JobStatus;
  answers: string;
  applied_at: string | null;
  notes: string;
  created_at: string;
};

type ContactRow = {
  id: string;
  name: string;
  title: string;
  company: string;
  platform: string;
  profile_url: string;
  status: ContactStatus;
  message_history: string;
  follow_up_date: string | null;
  notes: string;
  created_at: string;
};

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    for (const statement of schema) {
      db.prepare(statement).run();
    }
  }

  return db;
}

function parseJson<T>(value: string, fallback: T) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    url: row.url,
    platform: row.platform,
    jdText: row.jd_text,
    fitScore: row.fit_score,
    status: row.status,
    answers: parseJson(row.answers, {}),
    appliedAt: row.applied_at,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    company: row.company,
    platform: row.platform,
    profileUrl: row.profile_url,
    status: row.status,
    messageHistory: parseJson<OutreachMessage[]>(row.message_history, []),
    followUpDate: row.follow_up_date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function getJobs() {
  const rows = getDb()
    .prepare("SELECT * FROM jobs ORDER BY created_at DESC")
    .all() as JobRow[];

  return rows.map(toJob);
}

export function findJobByCompanyTitle(company: string, title: string) {
  const row = getDb()
    .prepare(
      "SELECT * FROM jobs WHERE lower(company) = lower(?) AND lower(title) = lower(?)",
    )
    .get(company.trim(), title.trim()) as JobRow | undefined;

  return row ? toJob(row) : null;
}

export function findCachedAnswer(params: {
  company: string;
  title: string;
  question: string;
}) {
  const job = findJobByCompanyTitle(params.company, params.title);
  return job?.answers[params.question] ?? null;
}

export function createJob(input: {
  title: string;
  company: string;
  url: string;
  platform: string;
  jdText?: string;
  fitScore?: number | null;
  status?: JobStatus;
  notes?: string;
}) {
  const existing = findJobByCompanyTitle(input.company, input.title);
  if (existing && existing.status !== "discovered") {
    return { duplicate: true as const, job: existing };
  }

  if (existing) {
    return { duplicate: false as const, job: existing };
  }

  const now = new Date().toISOString();
  const id = createId("job");
  getDb()
    .prepare(
      `INSERT INTO jobs (
        id, title, company, url, platform, jd_text, fit_score, status, answers, applied_at, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', NULL, ?, ?)`,
    )
    .run(
      id,
      input.title.trim(),
      input.company.trim(),
      input.url.trim(),
      input.platform.trim(),
      input.jdText?.trim() ?? "",
      input.fitScore ?? null,
      input.status ?? "discovered",
      input.notes?.trim() ?? "",
      now,
    );

  return { duplicate: false as const, job: getJob(id) };
}

export function getJob(id: string) {
  const row = getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
    | JobRow
    | undefined;

  if (!row) {
    throw new Error(`Job not found: ${id}`);
  }

  return toJob(row);
}

export function updateJob(input: {
  id: string;
  status?: JobStatus;
  notes?: string;
}) {
  const job = getJob(input.id);
  const appliedAt =
    input.status === "applied" && job.appliedAt === null
      ? new Date().toISOString()
      : job.appliedAt;

  getDb()
    .prepare(
      "UPDATE jobs SET status = ?, notes = ?, applied_at = ? WHERE id = ?",
    )
    .run(
      input.status ?? job.status,
      input.notes ?? job.notes,
      appliedAt,
      input.id,
    );

  return getJob(input.id);
}

export function saveAnswerForJob(params: {
  company: string;
  title: string;
  question: string;
  answer: string;
  url?: string;
  platform?: string;
  jdText?: string;
}) {
  const created = createJob({
    company: params.company,
    title: params.title,
    url: params.url ?? "",
    platform: params.platform ?? "extension",
    jdText: params.jdText ?? "",
  });
  const job = created.job;
  const answers = { ...job.answers, [params.question]: params.answer };

  getDb()
    .prepare(
      "UPDATE jobs SET answers = ?, jd_text = COALESCE(NULLIF(?, ''), jd_text) WHERE id = ?",
    )
    .run(JSON.stringify(answers), params.jdText ?? "", job.id);

  return getJob(job.id);
}

export function getContacts() {
  const rows = getDb()
    .prepare("SELECT * FROM contacts ORDER BY created_at DESC")
    .all() as ContactRow[];

  return rows.map(toContact);
}

export function countContactsToday(platform: string, status: ContactStatus) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) AS count FROM contacts WHERE platform = ? AND status = ? AND created_at >= ?",
    )
    .get(platform, status, start.toISOString()) as { count: number };

  return row.count;
}

export function getContact(id: string) {
  const row = getDb().prepare("SELECT * FROM contacts WHERE id = ?").get(id) as
    | ContactRow
    | undefined;

  if (!row) {
    throw new Error(`Contact not found: ${id}`);
  }

  return toContact(row);
}

export function updateContact(input: {
  id: string;
  status?: ContactStatus;
  messageBody?: string;
}) {
  const contact = getContact(input.id);
  const history =
    input.messageBody && contact.messageHistory.length > 0
      ? contact.messageHistory.map((message, index) =>
          index === contact.messageHistory.length - 1
            ? { ...message, body: input.messageBody ?? message.body }
            : message,
        )
      : contact.messageHistory;
  const followUpDate =
    input.status === "sent"
      ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      : contact.followUpDate;

  getDb()
    .prepare(
      "UPDATE contacts SET status = ?, message_history = ?, follow_up_date = ? WHERE id = ?",
    )
    .run(
      input.status ?? contact.status,
      JSON.stringify(history),
      followUpDate,
      input.id,
    );

  return getContact(input.id);
}

export function createContact(input: {
  name: string;
  title: string;
  company: string;
  platform: string;
  profileUrl: string;
  status?: ContactStatus;
  message?: OutreachMessage;
  followUpDate?: string | null;
  notes?: string;
}) {
  const id = createId("con");
  const now = new Date().toISOString();
  const history = input.message ? [input.message] : [];

  getDb()
    .prepare(
      `INSERT INTO contacts (
        id, name, title, company, platform, profile_url, status, message_history, follow_up_date, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.name.trim(),
      input.title.trim(),
      input.company.trim(),
      input.platform.trim(),
      input.profileUrl.trim(),
      input.status ?? "drafted",
      JSON.stringify(history),
      input.followUpDate ?? null,
      input.notes?.trim() ?? "",
      now,
    );

  return toContact(
    getDb()
      .prepare("SELECT * FROM contacts WHERE id = ?")
      .get(id) as ContactRow,
  );
}
