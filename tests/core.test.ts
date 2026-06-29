import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  classifyQuestion,
  deterministicProfileAnswer,
  enforceKeywordCoverage,
  enforceSalaryGuardrail,
  extractKeywords,
  extractProfileSkillKeywords,
} from "@/lib/ai";
import { contactIdentityKey } from "@/lib/contact-identity";
import { csvEscape, parseCsvObjects, toCsv } from "@/lib/csv";
import { createId } from "@/lib/id";
import {
  buildOutreachPrompt,
  getOutreachTemplate,
  validateOutreachTemplates,
} from "@/lib/outreach-templates";
import { getNextApplicationJobs, getPipelineSummary } from "@/lib/pipeline";
import { recommendResume } from "@/lib/resumes";
import { scoreJob } from "@/lib/scraper";
import type { Job } from "@/lib/types";

test("classifies salary questions", () => {
  assert.equal(classifyQuestion("What is your expected CTC?"), "salary");
});

test("classifies profile fields", () => {
  assert.equal(classifyQuestion("Full name"), "full_name");
  assert.equal(classifyQuestion("Email address"), "email");
  assert.equal(classifyQuestion("LinkedIn profile"), "linkedin");
});

test("resolves deterministic profile answers without AI", () => {
  assert.equal(
    deterministicProfileAnswer("email"),
    "moyezrabbani.work@gmail.com",
  );
  assert.equal(deterministicProfileAnswer("full_name"), "Moyez Rabbani");
});

test("recommends tailored resumes by role", () => {
  assert.equal(
    recommendResume({ role: "Applied AI Engineer" }).filename,
    "AI_Engineer.pdf",
  );
  assert.equal(
    recommendResume({ role: "Forward Deployed Engineer" }).filename,
    "Forward_Deployed_Engineer.pdf",
  );
});

test("normalizes salary answers to the required phrase", () => {
  assert.equal(
    enforceSalaryGuardrail("Expected CTC is 12-18 LPA.", "salary"),
    "Expected CTC is 12–18 LPA.",
  );
});

test("extracts useful JD keywords", () => {
  assert.deepEqual(
    extractKeywords("We need Next.js, TypeScript, RAG and Redis.").slice(0, 4),
    ["need", "next.js", "typescript", "rag"],
  );
});

test("extracts profile skill keywords from JD text", () => {
  assert.deepEqual(
    extractProfileSkillKeywords(
      "Need Next.js, TypeScript, Redis, and Docker.",
    ).slice(0, 4),
    ["Next.js", "TypeScript", "Docker", "Redis"],
  );
});

test("repairs answers missing relevant JD keywords", () => {
  const answer = enforceKeywordCoverage(
    "I have built production systems for similar roles.",
    "Need Next.js, TypeScript, Redis, and Docker.",
  );

  assert.match(answer, /Next\.js/);
  assert.match(answer, /TypeScript/);
});

test("creates short prefixed ids", () => {
  const id = createId("job");
  assert.match(id, /^job_[A-Za-z0-9_-]+$/);
  assert.ok(id.length < 20);
});

test("escapes CSV values", () => {
  assert.equal(csvEscape('A "quoted", value'), '"A ""quoted"", value"');
  assert.equal(
    toCsv([
      ["name", "note"],
      ["Moyez", "ships fast"],
    ]),
    "name,note\nMoyez,ships fast\n",
  );
});

test("parses CSV objects with quoted values", () => {
  assert.deepEqual(parseCsvObjects('name,notes\nAsha,"builds, ships"'), [
    { name: "Asha", notes: "builds, ships" },
  ]);
});

test("scores matching AI engineering jobs above scraper threshold", () => {
  const result = scoreJob(
    "Applied AI Engineer role using Next.js, TypeScript, Python, RAG, Azure, Redis, and Docker.",
  );
  assert.ok(result.score >= 6);
});

test("profile is present and not empty", () => {
  const profilePath = path.join(process.cwd(), "data", "profile.json");
  const profile = JSON.parse(fs.readFileSync(profilePath, "utf8")) as {
    name?: string;
  };
  assert.equal(profile.name, "Moyez Rabbani");
});

test("outreach templates are configurable by channel", () => {
  const noteTemplate = getOutreachTemplate("linkedin_note");
  const dmPrompt = buildOutreachPrompt("linkedin_dm");

  assert.equal(noteTemplate.maxChars, 280);
  assert.match(dmPrompt, /talked to 500\+ customers/);
  assert.match(dmPrompt, /LinkedIn DM/);
});

test("outreach template validation requires every channel", () => {
  assert.equal(
    validateOutreachTemplates({ globalRules: [], channels: {} }),
    false,
  );
});

test("prioritizes next applications by fit score", () => {
  const jobs = [
    jobFixture({
      id: "job_low",
      fitScore: 6,
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
    jobFixture({
      id: "job_applied",
      fitScore: 10,
      status: "applied",
      createdAt: "2026-01-03T00:00:00.000Z",
    }),
    jobFixture({
      id: "job_high",
      fitScore: 9,
      createdAt: "2026-01-02T00:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    getNextApplicationJobs(jobs).map((job) => job.id),
    ["job_high", "job_low"],
  );
});

test("summarizes daily application progress", () => {
  const now = new Date().toISOString();
  const summary = getPipelineSummary([
    jobFixture({ id: "job_today", status: "applied", appliedAt: now }),
    jobFixture({ id: "job_ready", fitScore: 9 }),
  ]);

  assert.equal(summary.appliedToday, 1);
  assert.equal(summary.readyToApply, 1);
  assert.equal(summary.highFit, 1);
  assert.equal(summary.targetRemaining, 19);
});

test("normalizes contact identity matching inputs", () => {
  const first = {
    name: "Asha Rao",
    title: "Founder",
    company: "SignalWorks",
  };
  const second = {
    name: " asha rao ",
    title: " founder ",
    company: " signalworks ",
  };

  assert.equal(contactIdentityKey(first), contactIdentityKey(second));
});

test("test db isolation directory exists when needed", () => {
  assert.ok(fs.existsSync(os.tmpdir()));
});

function jobFixture(overrides: Partial<Job>): Job {
  return {
    id: "job_fixture",
    title: "AI Engineer",
    company: "Fixture Co",
    url: "https://example.com",
    platform: "test",
    jdText: "",
    fitScore: 7,
    status: "discovered",
    answers: {},
    appliedAt: null,
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
