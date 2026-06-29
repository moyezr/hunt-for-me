import fs from "node:fs";
import path from "node:path";
import { getProfile } from "@/lib/profile";

export type ResumeRecommendation = {
  key: string;
  label: string;
  filename: string;
  reason: string;
  exists: boolean;
  relativePath: string;
};

const resumeRules = [
  {
    key: "forwardDeployedEngineer",
    label: "Forward Deployed Engineer",
    patterns: [
      /forward deployed/i,
      /\bfde\b/i,
      /founding/i,
      /solutions engineer/i,
    ],
    reason:
      "Best fit for customer-facing, ambiguous, implementation-heavy engineering roles.",
  },
  {
    key: "aiEngineer",
    label: "AI Engineer",
    patterns: [
      /\bai\b/i,
      /applied ai/i,
      /\bllm\b/i,
      /\brag\b/i,
      /agent/i,
      /machine learning/i,
    ],
    reason: "Best fit for AI, LLM, RAG, agent, and automation-heavy roles.",
  },
  {
    key: "fullStackSoftwareEngineer",
    label: "Full Stack Software Engineer",
    patterns: [
      /full[ -]?stack/i,
      /frontend/i,
      /backend/i,
      /react/i,
      /next\.?js/i,
    ],
    reason: "Best fit for product engineering and full-stack web roles.",
  },
  {
    key: "softwareEngineer",
    label: "Software Engineer",
    patterns: [/software engineer/i, /node/i, /typescript/i, /platform/i],
    reason: "Best general-purpose software engineering resume.",
  },
];

function findResumePath(filename: string) {
  const candidates = [
    path.join(process.cwd(), "data", "resumes", filename),
    path.join(/* turbopackIgnore: true */ process.cwd(), filename),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));

  return {
    exists: Boolean(found),
    relativePath: found
      ? path.relative(process.cwd(), found)
      : path.join("data", "resumes", filename),
  };
}

export function recommendResume(input: { role?: string; jdText?: string }) {
  const profile = getProfile();
  const text = `${input.role ?? ""} ${input.jdText ?? ""}`;
  const match =
    resumeRules.find((rule) =>
      rule.patterns.some((pattern) => pattern.test(text)),
    ) ?? resumeRules.at(-1);

  if (!match) {
    throw new Error("No resume rules configured");
  }

  const filename = profile.resumes[match.key];
  if (!filename) {
    throw new Error(`Resume not configured for ${match.key}`);
  }

  const resolved = findResumePath(filename);

  return {
    key: match.key,
    label: match.label,
    filename,
    reason: match.reason,
    exists: resolved.exists,
    relativePath: resolved.relativePath,
  } satisfies ResumeRecommendation;
}
