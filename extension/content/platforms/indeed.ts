import { readGenericContext } from "@/extension/content/platforms/common";

export function readIndeedContext() {
  const context = readGenericContext("indeed");
  const company =
    document
      .querySelector("[data-testid='inlineHeader-companyName']")
      ?.textContent?.trim() ||
    document.querySelector("[data-company-name='true']")?.textContent?.trim();
  const role =
    document
      .querySelector("[data-testid='jobsearch-JobInfoHeader-title']")
      ?.textContent?.trim() ||
    document.querySelector("h1")?.textContent?.trim();

  return {
    ...context,
    company: company || context.company,
    role: role || context.role,
  };
}
