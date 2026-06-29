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

  if (element.id) {
    const explicitLabel = document
      .querySelector(`label[for="${CSS.escape(element.id)}"]`)
      ?.textContent?.trim();
    if (explicitLabel) {
      return explicitLabel;
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

  const fieldsetLabel = element
    .closest("fieldset")
    ?.querySelector("legend")?.textContent;
  if (fieldsetLabel?.trim()) {
    return fieldsetLabel.trim();
  }

  const nearby =
    element
      .closest("[data-testid], .form-group, .field, .input, div")
      ?.textContent?.trim() || element.parentElement?.textContent?.trim();
  return nearby || "Application question";
}

function selectOptions(element: HTMLElement) {
  if (!(element instanceof HTMLSelectElement)) {
    return undefined;
  }

  return Array.from(element.options)
    .map((option) => option.textContent?.trim() || option.value.trim())
    .filter(Boolean);
}

export function detectFields(): DetectedField[] {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        "textarea",
        "select",
        "input:not([type])",
        "input[type='text']",
        "input[type='email']",
        "input[type='tel']",
        "input[type='url']",
        "input[type='number']",
        "input[type='search']",
      ].join(", "),
    ),
  ).filter((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true"
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
      options: selectOptions(element),
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

  if (element instanceof HTMLSelectElement) {
    const normalizedValue = value.trim().toLowerCase();
    const option = Array.from(element.options).find((item) => {
      const text = item.textContent?.trim().toLowerCase() ?? "";
      return (
        item.value.toLowerCase() === normalizedValue ||
        text === normalizedValue ||
        text.includes(normalizedValue) ||
        normalizedValue.includes(text)
      );
    });

    if (option) {
      element.value = option.value;
    } else {
      return false;
    }
  } else {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}
