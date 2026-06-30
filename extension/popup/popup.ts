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
const markAppliedButton =
  document.querySelector<HTMLButtonElement>("#markAppliedButton");
const applyButton = document.querySelector<HTMLButtonElement>("#applyButton");
const approveCheckbox =
  document.querySelector<HTMLInputElement>("#approveCheckbox");
const answersElement = document.querySelector<HTMLElement>("#answers");
const statusElement = document.querySelector<HTMLElement>("#status");
const pageContextElement = document.querySelector<HTMLElement>("#pageContext");
const resumeElement = document.querySelector<HTMLElement>(
  "#resumeRecommendation",
);
const maxAnswerFields = 20;

let drafts: DraftAnswer[] = [];
let context: PageContext | null = null;

function hasUsableContext(value: PageContext | null): value is PageContext {
  return Boolean(
    value?.company.trim() &&
      value.company !== "Unknown company" &&
      value.role.trim() &&
      value.role !== "Open role",
  );
}

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

function updateApplyState() {
  if (!applyButton) {
    return;
  }

  const isLoading = drafts.some((draft) => draft.category === "loading");
  if (approveCheckbox) {
    approveCheckbox.disabled = drafts.length === 0 || isLoading;
  }

  applyButton.disabled =
    drafts.length === 0 || isLoading || !approveCheckbox?.checked;
}

function clearApproval() {
  if (approveCheckbox) {
    approveCheckbox.checked = false;
  }
  updateApplyState();
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
      clearApproval();
    });

    wrapper.append(label, textarea);
    answersElement.append(wrapper);
  }

  updateApplyState();
}

function updateContextUi() {
  if (pageContextElement && context) {
    pageContextElement.textContent = `${context.company} - ${context.role}`;
  }

  if (saveJobButton) {
    saveJobButton.disabled = !hasUsableContext(context);
  }

  if (markAppliedButton) {
    markAppliedButton.disabled = !hasUsableContext(context);
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

function questionForField(field: DetectedField) {
  return field.options && field.options.length > 0
    ? `${field.label}\nOptions: ${field.options.join(", ")}`
    : field.label;
}

async function getAnswers(fields: DetectedField[]) {
  const activeContext = context;
  if (!hasUsableContext(activeContext)) {
    throw new Error("Detect the company and role before generating answers");
  }

  const response = await fetch(`${apiBase}/api/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questions: fields.map((field) => ({
        id: field.id,
        question: questionForField(field),
      })),
      company: activeContext.company,
      role: activeContext.role,
      jdText: activeContext.jdText,
      jobUrl: activeContext.url,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Answer requests failed");
  }

  const answerById = new Map(
    (
      payload.data.answers as {
        id: string;
        answer: string;
        category: string;
      }[]
    ).map((answer) => [answer.id, answer]),
  );

  return fields.map((field) => {
    const answer = answerById.get(field.id);
    if (!answer) {
      throw new Error(`Missing answer for ${field.label}`);
    }

    return {
      field,
      answer: answer.answer,
      category: answer.category,
    };
  });
}

function renderLoadingDrafts(fields: DetectedField[]) {
  clearApproval();
  drafts = fields.map((field) => ({
    field,
    answer: "Generating...",
    category: "loading",
  }));
  renderDrafts();
}

async function saveCurrentJob(status: "discovered" | "applied") {
  const activeContext = context;
  if (!hasUsableContext(activeContext)) {
    throw new Error("Detect the company and role before saving the job");
  }

  const response = await fetch(`${apiBase}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: activeContext.role,
      company: activeContext.company,
      url: activeContext.url,
      platform: activeContext.platform,
      jdText: activeContext.jdText,
      status,
    }),
  });
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Could not save job");
  }

  return payload.data.job as {
    id: string;
    status: string;
    appliedAt: string | null;
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
    if (!hasUsableContext(context)) {
      drafts = [];
      renderDrafts();
      if (resumeElement) {
        resumeElement.hidden = true;
      }
      throw new Error("Detect the company and role before generating answers");
    }

    await recommendResume();

    const answerFields = fields.slice(0, maxAnswerFields);
    setStatus(`Generating answers for ${answerFields.length} fields...`);
    renderLoadingDrafts(answerFields);
    drafts = await getAnswers(answerFields);
    clearApproval();
    renderDrafts();

    const skippedFields = Math.max(0, fields.length - answerFields.length);
    setStatus(
      skippedFields > 0
        ? `Review and edit before applying. ${skippedFields} extra field(s) need manual review. Nothing will be submitted.`
        : "Review and edit before applying. Nothing will be submitted.",
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Scan failed");
  }
});

saveJobButton?.addEventListener("click", async () => {
  try {
    await saveCurrentJob("discovered");
    setStatus("Job saved to dashboard.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not save job");
  }
});

markAppliedButton?.addEventListener("click", async () => {
  try {
    const job = await saveCurrentJob("applied");
    setStatus(
      job.appliedAt
        ? "Marked applied in dashboard."
        : "Marked applied. Check dashboard status.",
    );
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Could not mark applied",
    );
  }
});

approveCheckbox?.addEventListener("change", updateApplyState);

applyButton?.addEventListener("click", async () => {
  try {
    const tab = await currentTab();
    const result = (await chrome.tabs.sendMessage(tab.id ?? 0, {
      type: "HFM_FILL",
      answers: drafts.map((draft) => ({
        selector: draft.field.selector,
        answer: draft.answer,
      })),
    })) as {
      results?: { selector: string; filled: boolean }[];
    };
    const failedCount =
      result.results?.filter((item) => !item.filled).length ?? 0;
    setStatus(
      failedCount > 0
        ? `Filled approved answers, but ${failedCount} field(s) need manual review.`
        : "Filled approved answers. Review the page before submitting manually.",
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Fill failed");
  }
});

void pingHealth();
