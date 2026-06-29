import { readGenericContext } from "@/extension/content/platforms/common";

export function readWellfoundContext() {
  const context = readGenericContext("wellfound");
  const company =
    document
      .querySelector("[data-test='StartupHeader']")
      ?.textContent?.trim() ||
    document.querySelector("a[href*='/company/']")?.textContent?.trim();
  const role =
    document.querySelector("[data-test='JobTitle']")?.textContent?.trim() ||
    document.querySelector("h1")?.textContent?.trim();

  return {
    ...context,
    company: company || context.company,
    role: role || context.role,
  };
}
