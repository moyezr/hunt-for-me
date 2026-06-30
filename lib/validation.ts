import type { ScrapePlatform } from "@/lib/scraper";
import type { ContactStatus, JobStatus, OutreachMessage } from "@/lib/types";

const jobStatuses = [
  "discovered",
  "applied",
  "interviewing",
  "rejected",
  "offer",
];

const contactStatuses = [
  "new",
  "drafted",
  "sent",
  "follow_up_due",
  "responded",
  "closed",
];

const outreachChannels = [
  "linkedin_note",
  "linkedin_dm",
  "twitter_dm",
  "email",
];

const scrapePlatforms = ["naukri", "indeed", "wellfound"];

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && jobStatuses.includes(value);
}

export function isContactStatus(value: unknown): value is ContactStatus {
  return typeof value === "string" && contactStatuses.includes(value);
}

export function isOutreachChannel(
  value: unknown,
): value is OutreachMessage["channel"] {
  return typeof value === "string" && outreachChannels.includes(value);
}

export function isScrapePlatform(value: unknown): value is ScrapePlatform {
  return typeof value === "string" && scrapePlatforms.includes(value);
}
