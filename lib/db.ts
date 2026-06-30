import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { contactIdentityKey } from "@/lib/contact-identity";
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
    const nextUrl = input.url.trim() || existing.url;
    const inputPlatform = input.platform.trim();
    const nextPlatform =
      inputPlatform && inputPlatform !== "manual"
        ? inputPlatform
        : existing.platform || inputPlatform;
    const nextJdText = input.jdText?.trim() || existing.jdText;
    const nextFitScore = input.fitScore ?? existing.fitScore;
    const nextNotes = input.notes?.trim() || existing.notes;

    getDb()
      .prepare(
        "UPDATE jobs SET url = ?, platform = ?, jd_text = ?, fit_score = ?, notes = ? WHERE id = ?",
      )
      .run(
        nextUrl,
        nextPlatform,
        nextJdText,
        nextFitScore,
        nextNotes,
        existing.id,
      );

    if (input.status && input.status !== "discovered") {
      return {
        duplicate: false as const,
        job: updateJob({
          id: existing.id,
          status: input.status,
          notes: input.notes,
        }),
      };
    }

    return { duplicate: false as const, job: getJob(existing.id) };
  }

  const now = new Date().toISOString();
  const appliedAt = input.status === "applied" ? now : null;
  const id = createId("job");
  getDb()
    .prepare(
      `INSERT INTO jobs (
        id, title, company, url, platform, jd_text, fit_score, status, answers, applied_at, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?)`,
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
      appliedAt,
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

function startOfLocalDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWithinRange(value: string | null, start: Date, end: Date) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();
  return time >= start.getTime() && time < end.getTime();
}

export function countSentContactsForDay({
  contacts,
  platform,
  channel,
  date = new Date(),
}: {
  contacts: Contact[];
  platform: string;
  channel: OutreachMessage["channel"];
  date?: Date;
}) {
  const start = startOfLocalDay(date);
  const end = addDays(start, 1);
  const followUpStart = addDays(start, 3);
  const followUpEnd = addDays(end, 3);

  return contacts.filter(
    (contact) =>
      contact.platform === platform &&
      contact.status === "sent" &&
      contact.messageHistory.some((message) => message.channel === channel) &&
      (isWithinRange(contact.createdAt, start, end) ||
        isWithinRange(contact.followUpDate, followUpStart, followUpEnd)),
  ).length;
}

export function countSentMessagesToday(
  platform: string,
  channel: OutreachMessage["channel"],
) {
  return countSentContactsForDay({
    contacts: getContacts(),
    platform,
    channel,
  });
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

export function addMessageToContact(input: {
  id: string;
  message: OutreachMessage;
  status?: ContactStatus;
}) {
  const contact = getContact(input.id);
  const history = [...contact.messageHistory, input.message];

  getDb()
    .prepare("UPDATE contacts SET status = ?, message_history = ? WHERE id = ?")
    .run(input.status ?? "drafted", JSON.stringify(history), input.id);

  return getContact(input.id);
}

export function findContactByIdentity(input: {
  name: string;
  title: string;
  company: string;
  profileUrl?: string;
}) {
  const profileUrl = input.profileUrl?.trim();
  const row = profileUrl
    ? (getDb()
        .prepare("SELECT * FROM contacts WHERE profile_url = ?")
        .get(profileUrl) as ContactRow | undefined)
    : undefined;

  if (row) {
    return toContact(row);
  }

  const targetKey = contactIdentityKey(input);
  const identityRow = getDb()
    .prepare("SELECT * FROM contacts")
    .all()
    .find(
      (contact) => contactIdentityKey(contact as ContactRow) === targetKey,
    ) as ContactRow | undefined;

  return identityRow ? toContact(identityRow) : null;
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
  const existing = findContactByIdentity(input);
  if (existing) {
    const withMessage = input.message
      ? addMessageToContact({
          id: existing.id,
          message: input.message,
          status: input.status ?? "drafted",
        })
      : existing;

    if (input.status === "sent") {
      return updateContact({
        id: withMessage.id,
        status: "sent",
      });
    }

    if (
      input.status &&
      input.status !== "new" &&
      input.status !== withMessage.status
    ) {
      return updateContact({
        id: withMessage.id,
        status: input.status,
      });
    }

    return withMessage;
  }

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
