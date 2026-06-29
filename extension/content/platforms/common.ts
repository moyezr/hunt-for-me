import type { DetectedField, PageContext } from "@/extension/content/types";

function textFromSelectors(selectors: string[]) {
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  return "";
}

function selectorFor(element: Element, index: number) {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const name = element.getAttribute("name");
  if (name) {
    return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  }

  return `[data-hfm-field="${index}"]`;
}

function labelFor(element: HTMLElement) {
  const aria = element.getAttribute("aria-label");
  if (aria) {
    return aria;
  }

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = document.getElementById(labelledBy)?.textContent?.trim();
    if (label) {
      return label;
    }
  }

  const label = element.closest("label")?.textContent?.trim();
  if (label) {
    return label;
  }

  const placeholder = element.getAttribute("placeholder");
  if (placeholder) {
    return placeholder;
  }

  const nearby = element.parentElement?.textContent?.trim();
  return nearby || "Application question";
}

export function detectFields(): DetectedField[] {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(
      "textarea, input[type='text'], input[type='email'], input[type='tel'], input:not([type]), select",
    ),
  ).filter((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 && rect.height > 0 && !element.hasAttribute("disabled")
    );
  });

  return elements.map((element, index) => {
    element.dataset.hfmField = String(index);

    return {
      id: `field_${index}`,
      label: labelFor(element).slice(0, 240),
      selector: selectorFor(element, index),
      tagName: element.tagName.toLowerCase(),
      type: element.getAttribute("type") ?? element.tagName.toLowerCase(),
    };
  });
}

export function readGenericContext(platform: string): PageContext {
  const title = textFromSelectors([
    "h1",
    "[data-testid='jobsearch-JobInfoHeader-title']",
  ]);
  const company = textFromSelectors([
    "[data-testid='inlineHeader-companyName']",
    ".company-name",
    ".job-company",
    "a[href*='company']",
  ]);
  const jdText =
    textFromSelectors([
      "[data-testid='jobDescriptionText']",
      ".job-description",
      "main",
    ]) || document.body.innerText.slice(0, 6000);

  return {
    company: company || "Unknown company",
    role: title || document.title || "Open role",
    url: location.href,
    platform,
    jdText: jdText.slice(0, 6000),
  };
}

export function fillField(selector: string, value: string) {
  const element = document.querySelector<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >(selector);

  if (!element) {
    return false;
  }

  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}
