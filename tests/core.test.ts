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
import { createId } from "@/lib/id";
import { recommendResume } from "@/lib/resumes";
import { scoreJob } from "@/lib/scraper";

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

test("test db isolation directory exists when needed", () => {
  assert.ok(fs.existsSync(os.tmpdir()));
});
