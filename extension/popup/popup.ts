import type {
  DetectedField,
  DraftAnswer,
  PageContext,
} from "@/extension/content/types";

const apiBase = "http://localhost:3000";
const healthDot = document.querySelector<HTMLSpanElement>("#healthDot");
const scanButton = document.querySelector<HTMLButtonElement>("#scanButton");
const saveJobButton =
  document.querySelector<HTMLButtonElement>("#saveJobButton");
const applyButton = document.querySelector<HTMLButtonElement>("#applyButton");
const answersElement = document.querySelector<HTMLElement>("#answers");
const statusElement = document.querySelector<HTMLElement>("#status");
const pageContextElement = document.querySelector<HTMLElement>("#pageContext");
const resumeElement = document.querySelector<HTMLElement>(
  "#resumeRecommendation",
);

let drafts: DraftAnswer[] = [];
let context: PageContext | null = null;

function setStatus(message: string) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    throw new Error("No active tab");
  }

  return tab;
}

async function pingHealth() {
  try {
    const response = await fetch(`${apiBase}/api/health`);
    if (!response.ok) {
      throw new Error("Health check failed");
    }

    healthDot?.classList.add("ok");
    healthDot?.classList.remove("error");
  } catch {
    healthDot?.classList.add("error");
    healthDot?.classList.remove("ok");
  }
}

function renderDrafts() {
  if (!answersElement || !applyButton) {
    return;
  }

  answersElement.innerHTML = "";

  for (const draft of drafts) {
    const wrapper = document.createElement("article");
    wrapper.className = "answer";

    const label = document.createElement("label");
    label.textContent = draft.field.label;

    const textarea = document.createElement("textarea");
    textarea.value = draft.answer;
    textarea.addEventListener("input", () => {
      draft.answer = textarea.value;
    });

    wrapper.append(label, textarea);
    answersElement.append(wrapper);
  }

  applyButton.disabled = drafts.length === 0;
}

function updateContextUi() {
  if (pageContextElement && context) {
    pageContextElement.textContent = `${context.company} - ${context.role}`;
  }

  if (saveJobButton) {
    saveJobButton.disabled =
      !context || context.company === "Unknown company" || !context.role;
  }
}

async function recommendResume() {
  if (!context || !resumeElement) {
    return;
  }

  const response = await fetch(`${apiBase}/api/resumes/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: context.role,
      jdText: context.jdText,
    }),
  });
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    resumeElement.hidden = true;
    return;
  }

  const resume = payload.data.resume as {
    label: string;
    filename: string;
    reason: string;
    exists: boolean;
    relativePath: string;
  };
  resumeElement.hidden = false;
  resumeElement.innerHTML = `
    <strong>${resume.label} resume</strong>
    <code>${resume.filename}</code>
    <p>${resume.exists ? resume.relativePath : "File not found locally"}</p>
  `;
}

async function getAnswer(field: DetectedField) {
  if (!context) {
    throw new Error("Missing page context");
  }

  const response = await fetch(`${apiBase}/api/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: field.label,
      company: context.company,
      role: context.role,
      jdText: context.jdText,
      jobUrl: context.url,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Answer request failed");
  }

  return {
    field,
    answer: payload.data.answer as string,
    category: payload.data.category as string,
  };
}

scanButton?.addEventListener("click", async () => {
  try {
    setStatus("Scanning page...");
    const tab = await currentTab();
    const scan = await chrome.tabs.sendMessage(tab.id ?? 0, {
      type: "HFM_SCAN",
    });
    context = scan.context;
    const fields = scan.fields as DetectedField[];

    updateContextUi();
    await recommendResume();

    setStatus(`Generating answers for ${fields.length} fields...`);
    drafts = [];
    for (const field of fields.slice(0, 12)) {
      drafts.push(await getAnswer(field));
      renderDrafts();
    }

    setStatus("Review and edit before applying. Nothing will be submitted.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Scan failed");
  }
});

saveJobButton?.addEventListener("click", async () => {
  try {
    if (!context) {
      throw new Error("Scan the page before saving the job");
    }

    const response = await fetch(`${apiBase}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: context.role,
        company: context.company,
        url: context.url,
        platform: context.platform,
        jdText: context.jdText,
        status: "discovered",
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Could not save job");
    }

    setStatus("Job saved to dashboard.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not save job");
  }
});

applyButton?.addEventListener("click", async () => {
  try {
    const tab = await currentTab();
    await chrome.tabs.sendMessage(tab.id ?? 0, {
      type: "HFM_FILL",
      answers: drafts.map((draft) => ({
        selector: draft.field.selector,
        answer: draft.answer,
      })),
    });
    setStatus(
      "Filled approved answers. Review the page before submitting manually.",
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Fill failed");
  }
});

void pingHealth();
