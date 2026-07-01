import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  classifyQuestion,
  deterministicAnswerForQuestion,
  deterministicOptionAnswer,
  deterministicProfileAnswer,
  enforceAnswerSpecificity,
  enforceKeywordCoverage,
  enforceOutreachSalaryGuardrail,
  enforceOutreachSpecificity,
  enforceSalaryGuardrail,
  extractKeywords,
  extractProfileSkillKeywords,
  extractQuestionOptions,
  fallbackAnswer,
  fallbackOutreachMessage,
  generateJobFitScore,
  generateOutreach,
  getApplicationPrompt,
  getOpenRouterModel,
} from "@/lib/ai";
import { maxOutreachDraftBatchSize, takeBatch } from "@/lib/batch-limits";
import { contactIdentityKey } from "@/lib/contact-identity";
import { normalizeContactImportRow } from "@/lib/contact-import";
import { csvEscape, parseCsvObjects, toCsv } from "@/lib/csv";
import { getDailyPlan } from "@/lib/daily-plan";
import { countSentContactsForDay } from "@/lib/db";
import { createId } from "@/lib/id";
import {
  getDueFollowUpContacts,
  getInitialOutreachContacts,
} from "@/lib/outreach-queue";
import {
  buildOutreachPrompt,
  getOutreachTemplate,
  validateOutreachTemplates,
} from "@/lib/outreach-templates";
import { getNextApplicationJobs, getPipelineSummary } from "@/lib/pipeline";
import { recommendResume } from "@/lib/resumes";
import { isNewScrapedJob, scoreJob } from "@/lib/scraper";
import type { Contact, Job } from "@/lib/types";
import {
  defaultPlatformForChannel,
  isContactStatus,
  isJobFitScore,
  isJobStatus,
  isOutreachChannel,
  isScrapePlatform,
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
  assert.equal(classifyQuestion("Current employer"), "current_company");
  assert.equal(classifyQuestion("Current designation"), "current_title");
  assert.equal(
    classifyQuestion("Years of TypeScript experience"),
    "experience_years",
  );
});

test("classifies option choice fields", () => {
  assert.equal(
    classifyQuestion(
      "Preferred work mode\nOptions: Select one, Remote, Hybrid",
    ),
    "option_choice",
  );
});

test("classifies confirmation fields", () => {
  assert.equal(
    classifyQuestion("I confirm these details are accurate"),
    "confirmation",
  );
  assert.equal(
    classifyQuestion("I agree to the terms and conditions"),
    "confirmation",
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
  assert.equal(classifyQuestion("When can you join?"), "notice_period");
});

test("resolves deterministic profile answers without AI", () => {
  assert.equal(
    deterministicProfileAnswer("email"),
    "moyezrabbani.work@gmail.com",
  );
  assert.equal(deterministicProfileAnswer("full_name"), "Moyez Rabbani");
  assert.match(
    deterministicProfileAnswer("education") ?? "",
    /Bachelor of Technology, Computer Science and Engineering, Techno India University/,
  );
  assert.equal(
    deterministicProfileAnswer("current_company"),
    "FluxxForward - IT Consulting via WeeTravel",
  );
  assert.equal(
    deterministicProfileAnswer("current_title"),
    "Lead Software Engineer / Founding Engineer",
  );
  assert.equal(
    deterministicAnswerForQuestion("When can you join?"),
    "Available to discuss",
  );
  assert.match(
    deterministicAnswerForQuestion("Years of TypeScript experience") ?? "",
    /^\d+$/,
  );
  assert.equal(deterministicProfileAnswer("confirmation"), "Yes");
});

test("resolves deterministic option answers", () => {
  assert.deepEqual(
    extractQuestionOptions(
      "Preferred work mode\nOptions: Select one, Remote, Hybrid",
    ),
    ["Remote", "Hybrid"],
  );
  assert.equal(
    deterministicOptionAnswer(
      "Preferred work mode\nOptions: Select one, Remote, Hybrid",
    ),
    "Remote",
  );
  assert.equal(
    deterministicOptionAnswer(
      "Preferred interview format\nOptions: Phone, Video",
    ),
    "Video",
  );
  assert.equal(
    deterministicAnswerForQuestion(
      "Preferred interview format\nOptions: Phone, Video",
    ),
    "Video",
  );
  assert.equal(
    deterministicOptionAnswer(
      "Are you legally authorized to work in India?\nOptions: No, Yes",
    ),
    "Yes",
  );
  assert.equal(
    deterministicOptionAnswer(
      "Will you require visa sponsorship now or in the future?\nOptions: Yes, No",
    ),
    "No",
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

test("loads category-specific application prompt instructions", () => {
  const salaryPrompt = getApplicationPrompt("salary");
  const unknownPrompt = getApplicationPrompt("../unknown");

  assert.match(salaryPrompt, /Category-specific instructions/);
  assert.match(salaryPrompt, /12–18 LPA/);
  assert.doesNotMatch(unknownPrompt, /Category-specific instructions/);
});

test("resolves configured OpenRouter model alias", () => {
  const previous = process.env.OPENROUTER_MODEL;
  try {
    process.env.OPENROUTER_MODEL = "gpt-5.5-min";
    assert.equal(getOpenRouterModel(), "openai/gpt-5-mini");
  } finally {
    if (previous === undefined) {
      delete process.env.OPENROUTER_MODEL;
    } else {
      process.env.OPENROUTER_MODEL = previous;
    }
  }
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
  assert.equal(
    enforceAnswerSpecificity({
      answer: "Yes",
      company: "SignalWorks AI",
      role: "Applied AI Engineer",
      category: "confirmation",
    }),
    "Yes",
  );
  assert.equal(
    enforceAnswerSpecificity({
      answer: "Remote",
      company: "SignalWorks AI",
      role: "Applied AI Engineer",
      category: "option_choice",
    }),
    "Remote",
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

test("takes capped batches with remaining count", () => {
  const result = takeBatch(
    Array.from({ length: 22 }, (_, index) => index),
    maxOutreachDraftBatchSize,
  );

  assert.equal(result.items.length, 20);
  assert.equal(result.skipped, 2);
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

test("counts only newly created scraped jobs as saved", () => {
  const job = jobFixture({ id: "job_existing" });

  assert.equal(
    isNewScrapedJob({ duplicate: false, existing: false, job }),
    true,
  );
  assert.equal(
    isNewScrapedJob({ duplicate: false, existing: true, job }),
    false,
  );
  assert.equal(
    isNewScrapedJob({ duplicate: true, existing: true, job }),
    false,
  );
});

test("uses OpenRouter for job fit scoring when configured", async () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousFetch = globalThis.fetch;

  try {
    process.env.OPENROUTER_API_KEY = "test-key";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"score":8}' } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const result = await generateJobFitScore({
      title: "Applied AI Engineer",
      company: "SignalWorks",
      jdText: "Customer-facing role building RAG workflows and AI agents.",
    });

    assert.equal(result.score, 8);
    assert.equal(result.source, "ai");
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = previousKey;
    }
    globalThis.fetch = previousFetch;
  }
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
  assert.doesNotMatch(
    JSON.stringify(profile.education),
    /Not specified in current profile/,
  );
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

test("validates API status, outreach channel, and scraper platform enums", () => {
  assert.equal(isJobStatus("applied"), true);
  assert.equal(isJobStatus("submitted"), false);
  assert.equal(isJobFitScore(8), true);
  assert.equal(isJobFitScore(11), false);
  assert.equal(isJobFitScore(7.5), false);
  assert.equal(isContactStatus("follow_up_due"), true);
  assert.equal(isContactStatus("archived"), false);
  assert.equal(isOutreachChannel("linkedin_dm"), true);
  assert.equal(isOutreachChannel("sms"), false);
  assert.equal(isScrapePlatform("wellfound"), true);
  assert.equal(isScrapePlatform("linkedin"), false);
});

test("maps outreach channels to default contact platforms", () => {
  assert.equal(defaultPlatformForChannel("linkedin_note"), "linkedin");
  assert.equal(defaultPlatformForChannel("linkedin_dm"), "linkedin");
  assert.equal(defaultPlatformForChannel("twitter_dm"), "twitter");
  assert.equal(defaultPlatformForChannel("email"), "email");
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

test("fallback outreach email includes subject and company context", async () => {
  const message = fallbackOutreachMessage({
    name: "Asha Rao",
    title: "Founder",
    company: "SignalWorks",
    channel: "email",
    companyContext: "hiring applied AI engineers",
  });

  assert.match(message, /^Subject: Hands-on AI\/full-stack engineer/);
  assert.match(message, /Hi Asha/);
  assert.match(message, /hiring applied AI engineers at SignalWorks/);
});

test("email outreach fallback is used without OpenRouter", async () => {
  const previous = process.env.OPENROUTER_API_KEY;
  try {
    delete process.env.OPENROUTER_API_KEY;
    const message = await generateOutreach({
      name: "Asha Rao",
      title: "Founder",
      company: "SignalWorks",
      channel: "email",
      companyContext: "hiring applied AI engineers",
    });

    assert.match(message, /^Subject: Hands-on AI\/full-stack engineer/);
    assert.match(message, /SignalWorks/);
    assert.doesNotMatch(message, /salary|ctc|compensation|lpa|12/i);
  } finally {
    if (previous === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = previous;
    }
  }
});

test("outreach specificity preserves email subject lines", () => {
  const message = enforceOutreachSpecificity({
    body: "Subject: Quick chat\n\nHi Asha, I build AI systems fast.",
    company: "SignalWorks",
    companyContext: "hiring applied AI engineers",
  });

  assert.match(message, /^Subject: Quick chat\n\nNoticed hiring applied AI/);
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

test("normalizes flexible contact import headers", () => {
  const contact = normalizeContactImportRow({
    full_name: "Asha Rao",
    role: "Founder",
    organization: "SignalWorks",
    linkedin_url: "https://linkedin.com/in/asha",
    company_context: "hiring applied AI engineers",
  });

  assert.deepEqual(contact, {
    name: "Asha Rao",
    title: "Founder",
    company: "SignalWorks",
    platform: "linkedin",
    profileUrl: "https://linkedin.com/in/asha",
    notes: "hiring applied AI engineers",
  });
  assert.equal(normalizeContactImportRow({ name: "Missing Title" }), null);
});

test("outreach queues exclude replied and inactive contacts", () => {
  const now = new Date("2026-07-01T10:00:00.000Z");
  const dueDate = "2026-07-01T09:00:00.000Z";
  const futureDate = "2026-07-02T09:00:00.000Z";
  const contacts = [
    contactFixture({ id: "con_new", status: "new" }),
    contactFixture({ id: "con_drafted", status: "drafted" }),
    contactFixture({ id: "con_sent", status: "sent", followUpDate: dueDate }),
    contactFixture({
      id: "con_future",
      status: "sent",
      followUpDate: futureDate,
    }),
    contactFixture({
      id: "con_responded",
      status: "responded",
      followUpDate: dueDate,
    }),
    contactFixture({
      id: "con_closed",
      status: "closed",
      followUpDate: dueDate,
    }),
  ];

  assert.deepEqual(
    getInitialOutreachContacts(contacts).map((contact) => contact.id),
    ["con_new", "con_drafted"],
  );
  assert.deepEqual(
    getDueFollowUpContacts(contacts, now).map((contact) => contact.id),
    ["con_sent"],
  );
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

test("pipeline summary counts saved application answers", () => {
  const summary = getPipelineSummary([
    jobFixture({
      id: "job_with_answers",
      answers: {
        "Full name": "Moyez Rabbani",
        "Expected CTC": "12–18 LPA",
      },
    }),
    jobFixture({
      id: "job_with_one_answer",
      answers: {
        "Why this company?": "Specific answer",
      },
    }),
  ]);

  assert.equal(summary.savedAnswers, 3);
});

test("daily plan excludes closed and responded follow-ups", () => {
  const dueDate = new Date(Date.now() - 1000).toISOString();
  const plan = getDailyPlan({
    jobs: [],
    contacts: [
      contactFixture({
        id: "con_due",
        status: "sent",
        followUpDate: dueDate,
      }),
      contactFixture({
        id: "con_responded",
        status: "responded",
        followUpDate: dueDate,
      }),
      contactFixture({
        id: "con_closed",
        status: "closed",
        followUpDate: dueDate,
      }),
    ],
    linkedinNotesSent: 0,
    linkedinDmsSent: 0,
  });

  assert.equal(plan.outreach.followUpsDue, 1);
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
