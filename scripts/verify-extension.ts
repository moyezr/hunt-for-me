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
        <label>
          Why do you want to join SignalWorks AI?
          <textarea id="why-company"></textarea>
        </label>
        <label>
          Expected CTC
          <input id="salary" type="text" />
        </label>
      </form>
      <script>
        window.hfmEvents = [];
        for (const element of document.querySelectorAll("textarea, input")) {
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
      fields: { selector: string; label: string }[];
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
  if (!whyField) {
    throw new Error("Expected application question field was not detected");
  }
  if (!nameField) {
    throw new Error("Expected full-name field was not detected");
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

  const filled = await page.locator("#why-company").inputValue();
  const fullName = await page.locator("#full-name").inputValue();
  const events = await page.evaluate(() => window.hfmEvents);

  if (!filled.includes("SignalWorks AI")) {
    throw new Error("Approved answer was not filled into the textarea");
  }
  if (fullName !== "Moyez Rabbani") {
    throw new Error("Profile field was not filled into the input");
  }

  if (
    !events.includes("why-company:input") ||
    !events.includes("why-company:change")
  ) {
    throw new Error("React-compatible input/change events were not dispatched");
  }

  console.log("Extension content fill verification passed.");
} finally {
  await browser.close();
}
