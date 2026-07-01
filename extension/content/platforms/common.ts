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

  if (
    element instanceof HTMLInputElement &&
    ["checkbox", "radio"].includes(element.type)
  ) {
    const name = element.getAttribute("name");
    const value = element.getAttribute("value");
    if (name && value) {
      return `input[name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`;
    }

    return `[data-hfm-field="${index}"]`;
  }

  const name = element.getAttribute("name");
  if (name) {
    return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  }

  return `[data-hfm-field="${index}"]`;
}

function groupSelectorFor(
  element: HTMLInputElement,
  index: number,
  type: "checkbox" | "radio",
) {
  const name = element.getAttribute("name");
  if (name) {
    return `input[type="${type}"][name="${CSS.escape(name)}"]`;
  }

  return selectorFor(element, index);
}

function groupKeyFor(element: HTMLInputElement) {
  const name = element.getAttribute("name")?.trim();
  return name ? `${element.type}:${name}` : "";
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

function groupLabelFor(element: HTMLInputElement) {
  const fieldsetLabel = element
    .closest("fieldset")
    ?.querySelector("legend")?.textContent;
  if (fieldsetLabel?.trim()) {
    return fieldsetLabel.trim();
  }

  const groupLabel = element
    .closest("[role='radiogroup'], [role='group']")
    ?.getAttribute("aria-label");
  if (groupLabel?.trim()) {
    return groupLabel.trim();
  }

  const name = element.getAttribute("name");
  return name ? name.replace(/[-_]+/g, " ") : labelFor(element);
}

function compactOptions(options: string[]) {
  return Array.from(
    new Set(options.map((option) => option.trim()).filter(Boolean)),
  );
}

function selectOptions(element: HTMLElement) {
  if (element instanceof HTMLSelectElement) {
    return compactOptions(
      Array.from(element.options).map(
        (option) => option.textContent?.trim() || option.value.trim(),
      ),
    );
  }

  if (
    element instanceof HTMLInputElement &&
    ["checkbox", "radio"].includes(element.type)
  ) {
    return compactOptions([labelFor(element), element.value]);
  }

  return undefined;
}

export function detectFields(): DetectedField[] {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        "textarea",
        "select",
        "[contenteditable='true']",
        "[role='textbox']:not(input):not(textarea)",
        "input:not([type])",
        "input[type='text']",
        "input[type='email']",
        "input[type='tel']",
        "input[type='url']",
        "input[type='number']",
        "input[type='search']",
        "input[type='checkbox']",
        "input[type='radio']",
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

  const fields: DetectedField[] = [];
  const groupedInputs = new Set<HTMLInputElement>();

  elements.forEach((element, index) => {
    element.dataset.hfmField = String(index);

    if (
      element instanceof HTMLInputElement &&
      ["checkbox", "radio"].includes(element.type)
    ) {
      if (groupedInputs.has(element)) {
        return;
      }

      const key = groupKeyFor(element);
      const group = key
        ? elements.filter(
            (candidate): candidate is HTMLInputElement =>
              candidate instanceof HTMLInputElement &&
              candidate.type === element.type &&
              groupKeyFor(candidate) === key,
          )
        : [element];

      if (group.length > 1) {
        for (const input of group) {
          groupedInputs.add(input);
        }

        fields.push({
          id: `field_${fields.length}`,
          label: groupLabelFor(element).slice(0, 240),
          selector: groupSelectorFor(
            element,
            index,
            element.type as "checkbox" | "radio",
          ),
          tagName: element.tagName.toLowerCase(),
          type: element.type,
          options: compactOptions(
            group.flatMap((input) => selectOptions(input) ?? []),
          ),
        });
        return;
      }
    }

    fields.push({
      id: `field_${fields.length}`,
      label: labelFor(element).slice(0, 240),
      selector: selectorFor(element, index),
      tagName: element.tagName.toLowerCase(),
      type: element.getAttribute("type") ?? element.tagName.toLowerCase(),
      options: selectOptions(element),
    });
  });

  return fields;
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
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement
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
  } else if (
    element instanceof HTMLInputElement &&
    ["checkbox", "radio"].includes(element.type)
  ) {
    const normalizedValue = value.trim().toLowerCase();
    const namedGroup = element.getAttribute("name")
      ? Array.from(
          document.querySelectorAll<HTMLInputElement>(
            `input[type="${element.type}"][name="${CSS.escape(
              element.getAttribute("name") ?? "",
            )}"]`,
          ),
        )
      : [];
    const candidates = namedGroup.length > 1 ? namedGroup : [element];
    const answerParts = normalizedValue
      .split(/[,;/]|\bor\b|\band\b/)
      .map((part) => part.trim())
      .filter(Boolean);
    const isSingleCheckbox =
      candidates.length === 1 && element.type === "checkbox";

    const matches = candidates.filter((candidate) => {
      const label = labelFor(candidate).toLowerCase();
      const candidateValue = candidate.value.toLowerCase();
      return answerParts.some(
        (part) =>
          (isSingleCheckbox &&
            ["yes", "true", "checked", "agree", "accepted"].includes(part)) ||
          candidateValue === part ||
          label === part ||
          label.includes(part) ||
          part.includes(label),
      );
    });

    if (matches.length === 0) {
      return false;
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "checked",
    );

    for (const match of matches) {
      if (descriptor?.set) {
        descriptor.set.call(match, true);
      } else {
        match.checked = true;
      }
      match.dispatchEvent(new Event("input", { bubbles: true }));
      match.dispatchEvent(new Event("change", { bubbles: true }));
      if (match.type === "radio") {
        return true;
      }
    }

    return true;
  } else if (
    element instanceof HTMLElement &&
    (element.isContentEditable || element.getAttribute("role") === "textbox")
  ) {
    element.textContent = value;
  } else if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  } else {
    return false;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}
