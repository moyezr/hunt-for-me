import { readGenericContext } from "@/extension/content/platforms/common";

export function readNaukriContext() {
  const context = readGenericContext("naukri");
  const company =
    document.querySelector(".jd-header-comp-name")?.textContent?.trim() ||
    document.querySelector("[class*='company']")?.textContent?.trim();
  const role =
    document.querySelector(".jd-header-title")?.textContent?.trim() ||
    document.querySelector("h1")?.textContent?.trim();

  return {
    ...context,
    company: company || context.company,
    role: role || context.role,
  };
}
