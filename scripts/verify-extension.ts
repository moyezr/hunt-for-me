import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const contentScriptPath = path.join(
  process.cwd(),
  "extension",
  "dist",
  "content.js",
);
const popupScriptPath = path.join(
  process.cwd(),
  "extension",
  "dist",
  "popup.js",
);

const popupHtml = `<!doctype html>
<html>
  <body>
    <main>
      <header>
        <div>
          <h1>Hunt For Me</h1>
          <p id="pageContext">Scan a job application page.</p>
        </div>
        <span id="healthDot" title="Local API status"></span>
      </header>
      <div class="actions">
        <button id="scanButton" type="button">Scan</button>
        <button disabled id="saveJobButton" type="button">Save job</button>
        <button disabled id="markAppliedButton" type="button">Mark applied</button>
        <button disabled id="applyButton" type="button">Apply approved answers</button>
      </div>
      <section hidden id="resumeRecommendation" class="resume"></section>
      <section id="answers"></section>
      <p id="status"></p>
    </main>
  </body>
</html>`;

for (const file of [contentScriptPath, popupScriptPath]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing built extension file: ${file}`);
  }
}

const fixtureHtml = `<!doctype html>
<html>
  <head><title>Applied AI Engineer Job - Naukri</title></head>
  <body>
    <main>
      <h1 class="jd-header-title">Applied AI Engineer</h1>
      <a class="jd-header-comp-name">SignalWorks AI</a>
      <section class="job-description">
        We need an engineer with Next.js, TypeScript, RAG, Redis, Docker, Azure,
        and LLM application experience.
      </section>
      <form>
        <label>
          Full name
          <input id="full-name" type="text" />
        </label>
        <label>
          Email address
          <input id="email" type="email" />
        </label>
        <label for="portfolio">Portfolio URL</label>
        <input id="portfolio" type="url" />
        <label>
          Years of TypeScript experience
          <input id="years" type="number" />
        </label>
        <label>
          Preferred work mode
          <select id="work-mode">
            <option value="">Select one</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </label>
        <label>
          Why do you want to join SignalWorks AI?
          <textarea id="why-company"></textarea>
        </label>
        <label>
          Expected CTC
          <input id="salary" type="text" />
        </label>
        <button id="submit-application" type="submit">Submit application</button>
      </form>
      <script>
        window.hfmEvents = [];
        window.hfmSubmitted = false;
        document.querySelector("form").addEventListener("submit", (event) => {
          event.preventDefault();
          window.hfmSubmitted = true;
        });
        for (const element of document.querySelectorAll("textarea, input, select")) {
          element.addEventListener("input", () => window.hfmEvents.push(element.id + ":input"));
          element.addEventListener("change", () => window.hfmEvents.push(element.id + ":change"));
        }
      </script>
    </main>
  </body>
</html>`;

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    (window as unknown as { chrome: unknown }).chrome = {
      runtime: {
        onMessage: {
          addListener(listener: unknown) {
            window.__hfmContentListener = listener;
          },
        },
      },
    };
  });

  await page.route("https://www.naukri.com/job-listings-applied-ai", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: fixtureHtml,
    }),
  );
  await page.goto("https://www.naukri.com/job-listings-applied-ai");
  await page.addScriptTag({ path: contentScriptPath });

  const scan = await page.evaluate(async () => {
    return await new Promise<{
      context: { company: string; role: string; platform: string };
      fields: { selector: string; label: string; options?: string[] }[];
    }>((resolve) => {
      window.__hfmContentListener({ type: "HFM_SCAN" }, {}, resolve);
    });
  });

  if (scan.context.company !== "SignalWorks AI") {
    throw new Error(`Unexpected company: ${scan.context.company}`);
  }

  if (scan.context.role !== "Applied AI Engineer") {
    throw new Error(`Unexpected role: ${scan.context.role}`);
  }

  if (scan.context.platform !== "naukri") {
    throw new Error(`Unexpected platform: ${scan.context.platform}`);
  }

  const whyField = scan.fields.find((field) =>
    field.label.includes("Why do you want to join"),
  );
  const nameField = scan.fields.find((field) =>
    field.label.includes("Full name"),
  );
  const portfolioField = scan.fields.find((field) =>
    field.label.includes("Portfolio URL"),
  );
  const yearsField = scan.fields.find((field) =>
    field.label.includes("Years of TypeScript"),
  );
  const workModeField = scan.fields.find((field) =>
    field.label.includes("Preferred work mode"),
  );
  if (!whyField) {
    throw new Error("Expected application question field was not detected");
  }
  if (!nameField) {
    throw new Error("Expected full-name field was not detected");
  }
  if (!portfolioField) {
    throw new Error("Expected explicit label URL field was not detected");
  }
  if (!yearsField) {
    throw new Error("Expected number field was not detected");
  }
  if (!workModeField?.options?.includes("Remote")) {
    throw new Error("Expected select options were not detected");
  }

  await page.evaluate(async (selector) => {
    await new Promise((resolve) => {
      window.__hfmContentListener(
        {
          type: "HFM_FILL",
          answers: [
            {
              selector,
              answer:
                "I am interested in SignalWorks AI because the Applied AI Engineer role matches my production LLM, RAG, and full-stack systems experience.",
            },
          ],
        },
        {},
        resolve,
      );
    });
  }, whyField.selector);

  await page.evaluate(async (selector) => {
    await new Promise((resolve) => {
      window.__hfmContentListener(
        {
          type: "HFM_FILL",
          answers: [{ selector, answer: "Moyez Rabbani" }],
        },
        {},
        resolve,
      );
    });
  }, nameField.selector);

  await page.evaluate(async (selector) => {
    await new Promise((resolve) => {
      window.__hfmContentListener(
        {
          type: "HFM_FILL",
          answers: [{ selector, answer: "Remote" }],
        },
        {},
        resolve,
      );
    });
  }, workModeField.selector);

  const filled = await page.locator("#why-company").inputValue();
  const fullName = await page.locator("#full-name").inputValue();
  const workMode = await page.locator("#work-mode").inputValue();
  const events = await page.evaluate(() => window.hfmEvents);
  const submitted = await page.evaluate(() => window.hfmSubmitted);

  if (!filled.includes("SignalWorks AI")) {
    throw new Error("Approved answer was not filled into the textarea");
  }
  if (fullName !== "Moyez Rabbani") {
    throw new Error("Profile field was not filled into the input");
  }
  if (workMode !== "remote") {
    throw new Error("Select field was not matched and filled by option text");
  }
  if (submitted) {
    throw new Error("Extension submitted the application form while filling");
  }

  if (
    !events.includes("why-company:input") ||
    !events.includes("why-company:change")
  ) {
    throw new Error("React-compatible input/change events were not dispatched");
  }

  const popupPage = await browser.newPage();
  const popupApiRequests: string[] = [];
  const popupJobSaves: {
    title: string;
    company: string;
    url: string;
    platform: string;
    status: string;
  }[] = [];
  let popupFillAnswers: { selector: string; answer: string }[] = [];
  await popupPage.exposeFunction("hfmMockSendMessage", (message: unknown) => {
    const typedMessage = message as {
      type: string;
      answers?: { selector: string; answer: string }[];
    };

    if (typedMessage.type === "HFM_SCAN") {
      return {
        context: {
          company: "SignalWorks AI",
          role: "Applied AI Engineer",
          url: "https://www.naukri.com/job-listings-applied-ai",
          platform: "naukri",
          jdText: "Need Next.js, TypeScript, RAG, Redis, Docker, and Azure.",
        },
        fields: [
          {
            id: "field_name",
            label: "Full name",
            selector: "#full-name",
            tagName: "input",
            type: "text",
          },
          {
            id: "field_mode",
            label: "Preferred work mode",
            selector: "#work-mode",
            tagName: "select",
            type: "select",
            options: ["Select one", "Remote", "Hybrid"],
          },
          {
            id: "field_why",
            label: "Why do you want to join SignalWorks AI?",
            selector: "#why-company",
            tagName: "textarea",
            type: "textarea",
          },
        ],
      };
    }

    if (typedMessage.type === "HFM_FILL") {
      popupFillAnswers = typedMessage.answers ?? [];
      return { results: typedMessage.answers?.map(() => ({ filled: true })) };
    }

    return {};
  });
  await popupPage.route("http://localhost:3000/api/**", async (route) => {
    const url = new URL(route.request().url());
    popupApiRequests.push(url.pathname);

    if (url.pathname === "/api/health") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { status: "healthy", service: "hunt-for-me" },
        }),
      });
      return;
    }

    if (url.pathname === "/api/resumes/recommend") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            resume: {
              label: "AI Engineer",
              filename: "AI_Engineer.pdf",
              reason: "Best fit",
              exists: true,
              relativePath: "AI_Engineer.pdf",
            },
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/answers") {
      const requestBody = route.request().postDataJSON() as {
        questions: { id: string; question: string }[];
      };
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            answers: requestBody.questions.map((question) => ({
              id: question.id,
              question: question.question,
              category: question.id === "field_name" ? "full_name" : "general",
              answer:
                question.id === "field_name"
                  ? "Moyez Rabbani"
                  : question.id === "field_mode"
                    ? "Remote"
                    : "SignalWorks AI is a strong fit for my production AI and full-stack work.",
              matchedKeywords: [],
              cached: false,
            })),
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/jobs") {
      const requestBody = route.request().postDataJSON() as {
        title: string;
        company: string;
        url: string;
        platform: string;
        status: string;
      };
      popupJobSaves.push(requestBody);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            job: {
              id: "job_popup",
              ...requestBody,
              appliedAt:
                requestBody.status === "applied"
                  ? new Date().toISOString()
                  : null,
            },
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Unexpected popup API call" }),
    });
  });
  await popupPage.setContent(popupHtml);
  await popupPage.evaluate(() => {
    (window as unknown as { chrome: unknown }).chrome = {
      tabs: {
        async query() {
          return [{ id: 1 }];
        },
        async sendMessage(_tabId: number, message: unknown) {
          return await (
            window as unknown as {
              hfmMockSendMessage(input: unknown): Promise<unknown>;
            }
          ).hfmMockSendMessage(message);
        },
      },
    };
  });
  await popupPage.addScriptTag({ path: popupScriptPath });
  await popupPage.waitForFunction(() =>
    document.querySelector("#healthDot")?.classList.contains("ok"),
  );
  if (!popupApiRequests.includes("/api/health")) {
    throw new Error("Popup did not call the health endpoint");
  }
  await popupPage.locator("#scanButton").click();
  await popupPage.locator("textarea").first().waitFor();
  if (!(await popupPage.locator("#applyButton").isDisabled())) {
    throw new Error(
      "Apply button was enabled while popup answers were loading",
    );
  }
  await popupPage
    .locator("#status")
    .getByText("Review and edit before applying")
    .waitFor();

  if (!popupApiRequests.includes("/api/answers")) {
    throw new Error("Popup did not call the batch answers endpoint");
  }
  if (popupApiRequests.includes("/api/answer")) {
    throw new Error("Popup called single-answer endpoint during batch scan");
  }

  if (await popupPage.locator("#saveJobButton").isDisabled()) {
    throw new Error("Save job button was not enabled after scanning context");
  }
  await popupPage.locator("#saveJobButton").click();
  await popupPage
    .locator("#status")
    .getByText("Job saved to dashboard")
    .waitFor();

  if (await popupPage.locator("#markAppliedButton").isDisabled()) {
    throw new Error(
      "Mark applied button was not enabled after scanning context",
    );
  }
  await popupPage.locator("#markAppliedButton").click();
  await popupPage
    .locator("#status")
    .getByText("Marked applied in dashboard")
    .waitFor();

  const discoveredSave = popupJobSaves.find(
    (save) => save.status === "discovered",
  );
  const appliedSave = popupJobSaves.find((save) => save.status === "applied");
  if (!discoveredSave || !appliedSave) {
    throw new Error(
      "Popup did not save both discovered and applied job states",
    );
  }
  if (
    discoveredSave.company !== "SignalWorks AI" ||
    discoveredSave.title !== "Applied AI Engineer" ||
    discoveredSave.platform !== "naukri"
  ) {
    throw new Error("Popup saved incorrect discovered job context");
  }

  const popupAnswers = await popupPage
    .locator("#answers textarea")
    .evaluateAll((textareas) =>
      textareas.map((textarea) => (textarea as HTMLTextAreaElement).value),
    );
  if (
    popupAnswers.length !== 3 ||
    !popupAnswers.includes("Moyez Rabbani") ||
    !popupAnswers.includes("Remote")
  ) {
    throw new Error("Popup did not render batch-generated draft answers");
  }

  if (await popupPage.locator("#applyButton").isDisabled()) {
    throw new Error("Apply button was not enabled after answers loaded");
  }

  await popupPage.locator("#applyButton").click();
  if (
    popupFillAnswers.length !== 3 ||
    !popupFillAnswers.some((answer) => answer.answer === "Moyez Rabbani")
  ) {
    throw new Error(
      "Popup did not send approved answers to the content script",
    );
  }

  console.log("Extension content and popup verification passed.");
} finally {
  await browser.close();
}
