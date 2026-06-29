import { readGenericContext } from "@/extension/content/platforms/common";

export function readLinkedInContext() {
  const context = readGenericContext("linkedin");
  const company =
    document
      .querySelector(".jobs-unified-top-card__company-name")
      ?.textContent?.trim() ||
    document
      .querySelector(".job-details-jobs-unified-top-card__company-name")
      ?.textContent?.trim();
  const role =
    document
      .querySelector(".jobs-unified-top-card__job-title")
      ?.textContent?.trim() ||
    document
      .querySelector(".job-details-jobs-unified-top-card__job-title")
      ?.textContent?.trim() ||
    document.querySelector("h1")?.textContent?.trim();

  return {
    ...context,
    company: company || context.company,
    role: role || context.role,
  };
}
