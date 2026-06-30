import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  classifyQuestion,
  deterministicProfileAnswer,
  enforceAnswerSpecificity,
  enforceKeywordCoverage,
  enforceOutreachSalaryGuardrail,
  enforceOutreachSpecificity,
  enforceSalaryGuardrail,
  extractKeywords,
  extractProfileSkillKeywords,
  fallbackAnswer,
} from "@/lib/ai";
import { contactIdentityKey } from "@/lib/contact-identity";
import { csvEscape, parseCsvObjects, toCsv } from "@/lib/csv";
import { getDailyPlan } from "@/lib/daily-plan";
import { countSentContactsForDay } from "@/lib/db";
import { createId } from "@/lib/id";
import {
  buildOutreachPrompt,
  getOutreachTemplate,
  validateOutreachTemplates,
} from "@/lib/outreach-templates";
import { getNextApplicationJobs, getPipelineSummary } from "@/lib/pipeline";
import { recommendResume } from "@/lib/resumes";
import { scoreJob } from "@/lib/scraper";
import type { Contact, Job } from "@/lib/types";
import {
  isContactStatus,
  isJobStatus,
  isOutreachChannel,
} from "@/lib/validation";

test("classifies salary questions", () => {
  assert.equal(classifyQuestion("What is your expected CTC?"), "salary");
});

test("classifies profile fields", () => {
  assert.equal(classifyQuestion("Full name"), "full_name");
  assert.equal(classifyQuestion("Email address"), "email");
  assert.equal(classifyQuestion("LinkedIn profile"), "linkedin");
  assert.equal(
    classifyQuestion("Highest education qualification"),
    "education",
  );
});

test("classifies narrative motivation questions", () => {
  assert.equal(
    classifyQuestion("Why are you looking for a new role?"),
    "why_looking",
  );
  assert.equal(
    classifyQuestion("Reason for leaving your last role"),
    "why_leaving",
  );
  assert.equal(
    classifyQuestion("Where do you see yourself in five years?"),
    "career_goal",
  );
});

test("resolves deterministic profile answers without AI", () => {
  assert.equal(
    deterministicProfileAnswer("email"),
    "moyezrabbani.work@gmail.com",
  );
  assert.equal(deterministicProfileAnswer("full_name"), "Moyez Rabbani");
  assert.match(
    deterministicProfileAnswer("education") ?? "",
    /Software engineering and applied AI experience/,
  );
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

test("repairs generic application answers with company and role context", () => {
  const answer = enforceAnswerSpecificity({
    answer:
      "I am looking for stronger ownership, faster shipping cycles, and closer customer contact.",
    company: "SignalWorks AI",
    role: "Applied AI Engineer",
    category: "why_leaving",
  });

  assert.match(answer, /SignalWorks AI/);
  assert.match(answer, /Applied AI Engineer/);
});

test("keeps deterministic and salary answers concise", () => {
  assert.equal(
    enforceAnswerSpecificity({
      answer: "Moyez Rabbani",
      company: "SignalWorks AI",
      role: "Applied AI Engineer",
      category: "full_name",
    }),
    "Moyez Rabbani",
  );
  assert.equal(
    enforceAnswerSpecificity({
      answer: "My expected compensation is 12–18 LPA.",
      company: "SignalWorks AI",
      role: "Applied AI Engineer",
      category: "salary",
    }),
    "My expected compensation is 12–18 LPA.",
  );
});

test("answers why-looking prompts from profile narrative", () => {
  const answer = fallbackAnswer({
    question: "Why are you looking for a new role?",
    company: "SignalWorks AI",
    role: "Applied AI Engineer",
    jdText: "Need Next.js and TypeScript.",
  });

  assert.match(answer, /more ownership/);
  assert.match(answer, /closer contact with customers/);
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

test("scores unrelated jobs below scraper save threshold", () => {
  const result = scoreJob("Restaurant manager role with inventory scheduling.");
  assert.ok(result.score < 6);
});

test("profile is present and not empty", () => {
  const profilePath = path.join(process.cwd(), "data", "profile.json");
  const profile = JSON.parse(fs.readFileSync(profilePath, "utf8")) as {
    name?: string;
    education?: unknown[];
  };
  assert.equal(profile.name, "Moyez Rabbani");
  assert.ok(Array.isArray(profile.education));
  assert.ok(profile.education.length > 0);
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

test("validates API status and outreach channel enums", () => {
  assert.equal(isJobStatus("applied"), true);
  assert.equal(isJobStatus("submitted"), false);
  assert.equal(isContactStatus("follow_up_due"), true);
  assert.equal(isContactStatus("archived"), false);
  assert.equal(isOutreachChannel("linkedin_dm"), true);
  assert.equal(isOutreachChannel("sms"), false);
});

test("removes salary language from outreach messages", () => {
  const message = enforceOutreachSalaryGuardrail(
    "Hi Asha, noticed SignalWorks is hiring AI engineers. My expected CTC is 12-18 LPA. I ship production AI systems fast.",
  );

  assert.doesNotMatch(message, /salary|ctc|compensation|lpa|12/i);
  assert.match(message, /SignalWorks/);
  assert.match(message, /ship production AI systems fast/);
});

test("replaces fully unsafe outreach salary messages", () => {
  const message = enforceOutreachSalaryGuardrail(
    "Expected compensation is 12–18 LPA.",
  );

  assert.doesNotMatch(message, /salary|ctc|compensation|lpa|12/i);
  assert.match(message, /AI and full-stack systems/);
});

test("adds company context to generic outreach messages", () => {
  const message = enforceOutreachSpecificity({
    body: "Hi Asha, I build AI systems fast. Open to chat?",
    company: "SignalWorks",
    companyContext: "hiring applied AI engineers for customer workflows",
  });

  assert.match(message, /^Hi Asha, Noticed hiring applied AI engineers/);
});

test("keeps already specific outreach messages unchanged", () => {
  const body =
    "Hi Asha, noticed hiring applied AI engineers for customer workflows. I build fast.";

  assert.equal(
    enforceOutreachSpecificity({
      body,
      company: "SignalWorks",
      companyContext: "hiring applied AI engineers for customer workflows",
    }),
    body,
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

test("builds a daily job hunt operating plan", () => {
  const plan = getDailyPlan({
    jobs: [jobFixture({ id: "job_ready" })],
    contacts: [
      contactFixture({ id: "con_new", status: "new" }),
      contactFixture({
        id: "con_due",
        status: "sent",
        followUpDate: new Date(Date.now() - 1000).toISOString(),
      }),
    ],
    linkedinNotesSent: 4,
    linkedinDmsSent: 2,
  });

  assert.equal(plan.applications.readyToApply, 1);
  assert.equal(plan.outreach.linkedinNotesRemaining, 11);
  assert.equal(plan.outreach.linkedinDmsRemaining, 8);
  assert.equal(plan.outreach.followUpsDue, 1);
  assert.equal(plan.outreach.unsentContacts, 1);
});

test("counts linkedin outreach caps from sent contact history", () => {
  const now = new Date();
  const followUpDate = new Date(now);
  followUpDate.setDate(followUpDate.getDate() + 3);
  const oldFollowUpDate = new Date(now);
  oldFollowUpDate.setDate(oldFollowUpDate.getDate() + 2);

  const contacts = [
    ...Array.from({ length: 15 }, (_, index) =>
      contactFixture({
        id: `con_note_${index}`,
        status: "sent",
        followUpDate: followUpDate.toISOString(),
        messageHistory: [
          {
            channel: "linkedin_note",
            body: "Connection note",
            createdAt: now.toISOString(),
          },
        ],
      }),
    ),
    ...Array.from({ length: 10 }, (_, index) =>
      contactFixture({
        id: `con_dm_${index}`,
        status: "sent",
        followUpDate: followUpDate.toISOString(),
        messageHistory: [
          {
            channel: "linkedin_dm",
            body: "LinkedIn DM",
            createdAt: now.toISOString(),
          },
        ],
      }),
    ),
    contactFixture({
      id: "con_drafted",
      status: "drafted",
      followUpDate: followUpDate.toISOString(),
      messageHistory: [
        {
          channel: "linkedin_note",
          body: "Drafted note",
          createdAt: now.toISOString(),
        },
      ],
    }),
    contactFixture({
      id: "con_old",
      status: "sent",
      followUpDate: oldFollowUpDate.toISOString(),
      messageHistory: [
        {
          channel: "linkedin_note",
          body: "Old note",
          createdAt: now.toISOString(),
        },
      ],
    }),
    contactFixture({
      id: "con_twitter",
      platform: "twitter",
      status: "sent",
      followUpDate: followUpDate.toISOString(),
      messageHistory: [
        {
          channel: "twitter_dm",
          body: "Twitter DM",
          createdAt: now.toISOString(),
        },
      ],
    }),
  ];

  assert.equal(
    countSentContactsForDay({
      contacts,
      platform: "linkedin",
      channel: "linkedin_note",
      date: now,
    }),
    15,
  );
  assert.equal(
    countSentContactsForDay({
      contacts,
      platform: "linkedin",
      channel: "linkedin_dm",
      date: now,
    }),
    10,
  );
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

function contactFixture(overrides: Partial<Contact>): Contact {
  return {
    id: "con_fixture",
    name: "Asha Rao",
    title: "Founder",
    company: "SignalWorks",
    platform: "linkedin",
    profileUrl: "https://linkedin.com/in/asha",
    status: "new",
    messageHistory: [],
    followUpDate: null,
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
