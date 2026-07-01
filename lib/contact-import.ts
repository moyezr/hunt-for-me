import { isUsableOutreachContact } from "@/lib/validation";

type ContactImportRow = Record<string, string>;

function firstValue(row: ContactImportRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function inferPlatform(row: ContactImportRow, profileUrl: string) {
  const platform = firstValue(row, ["platform", "source", "channel"]);
  if (platform) {
    return platform.toLowerCase();
  }

  const url = profileUrl.toLowerCase();
  if (url.includes("twitter.com") || url.includes("x.com")) {
    return "twitter";
  }

  if (url.startsWith("mailto:") || row.email?.trim()) {
    return "email";
  }

  return "linkedin";
}

export function normalizeContactImportRow(row: ContactImportRow) {
  const name = firstValue(row, ["name", "full_name", "fullname", "person"]);
  const title = firstValue(row, [
    "title",
    "role",
    "job_title",
    "position",
    "headline",
  ]);
  const company = firstValue(row, [
    "company",
    "organization",
    "current_company",
    "company_name",
  ]);

  if (!name || !isUsableOutreachContact({ company, title })) {
    return null;
  }

  const profileUrl = firstValue(row, [
    "profile_url",
    "profileurl",
    "profile",
    "linkedin_url",
    "linkedin",
    "twitter_url",
    "x_url",
    "url",
  ]);

  return {
    name,
    title,
    company,
    platform: inferPlatform(row, profileUrl),
    profileUrl,
    notes: firstValue(row, [
      "notes",
      "note",
      "company_context",
      "companycontext",
      "context",
      "company_notes",
      "about_company",
    ]),
  };
}
