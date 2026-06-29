import fs from "node:fs";
import path from "node:path";
import type {
  OutreachMessage,
  OutreachTemplate,
  OutreachTemplateConfig,
} from "@/lib/types";

const templatesPath = path.join(
  process.cwd(),
  "data",
  "outreach-templates.json",
);
const channels: OutreachMessage["channel"][] = [
  "linkedin_note",
  "linkedin_dm",
  "twitter_dm",
  "email",
];

function isStringArray(value: unknown) {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function validateTemplate(value: unknown): value is OutreachTemplate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const template = value as OutreachTemplate;
  return (
    typeof template.label === "string" &&
    typeof template.goal === "string" &&
    (typeof template.maxChars === "number" || template.maxChars === null) &&
    isStringArray(template.structure) &&
    isStringArray(template.examples)
  );
}

export function validateOutreachTemplates(
  value: unknown,
): value is OutreachTemplateConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const config = value as OutreachTemplateConfig;
  return (
    isStringArray(config.globalRules) &&
    isStringArray(config.proofPoints) &&
    Boolean(config.channels) &&
    channels.every((channel) => validateTemplate(config.channels[channel]))
  );
}

export function getOutreachTemplates() {
  const parsed = JSON.parse(fs.readFileSync(templatesPath, "utf8")) as unknown;

  if (!validateOutreachTemplates(parsed)) {
    throw new Error("Invalid outreach template config");
  }

  return parsed;
}

export function writeOutreachTemplates(config: unknown) {
  if (!validateOutreachTemplates(config)) {
    throw new Error(
      "Template config must include globalRules, proofPoints, and all outreach channels",
    );
  }

  fs.writeFileSync(templatesPath, `${JSON.stringify(config, null, 2)}\n`);
  return getOutreachTemplates();
}

export function getOutreachTemplate(channel: OutreachMessage["channel"]) {
  return getOutreachTemplates().channels[channel];
}

export function buildOutreachPrompt(channel: OutreachMessage["channel"]) {
  const config = getOutreachTemplates();
  const template = config.channels[channel];
  const maxChars = template.maxChars
    ? `Stay under ${template.maxChars} characters.`
    : "Use the shortest complete message that fits the ask.";

  return [
    "You write outbound messages for Moyez Rabbani.",
    "",
    "Global rules:",
    ...config.globalRules.map((rule) => `- ${rule}`),
    "",
    "Personal proof points to choose from:",
    ...config.proofPoints.map((point) => `- ${point}`),
    "",
    `Channel: ${template.label}`,
    `Goal: ${template.goal}`,
    maxChars,
    "",
    "Preferred structure:",
    ...template.structure.map((step) => `- ${step}`),
    "",
    "Examples are style references, not text to copy:",
    ...template.examples.map((example) => `- ${example}`),
  ].join("\n");
}
