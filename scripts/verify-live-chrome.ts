import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

type LiveTarget = {
  name: string;
  url: string;
  loginPatterns: RegExp[];
  expectedPatterns?: RegExp[];
};

const workEmail = "moyezrabbani.work@gmail.com";
const workProfileDirectory =
  process.env.HFM_CHROME_PROFILE_DIRECTORY ?? "Profile 1";
const chromeUserDataDir = path.join(
  process.env.HOME ?? "",
  "Library",
  "Application Support",
  "Google",
  "Chrome",
);
const chromeBinary = process.env.HFM_CHROME_BINARY
  ? process.env.HFM_CHROME_BINARY
  : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const defaultTargets: LiveTarget[] = [
  {
    name: "linkedin",
    url: "https://www.linkedin.com/feed/",
    loginPatterns: [/sign in/i, /join linkedin/i, /authwall/i],
    expectedPatterns: [/linkedin/i],
  },
  {
    name: "naukri",
    url: "https://www.naukri.com/mnjuser/homepage",
    loginPatterns: [/login to naukri/i, /register for free/i],
    expectedPatterns: [/naukri/i],
  },
  {
    name: "indeed",
    url: "https://profile.indeed.com/",
    loginPatterns: [/sign in/i, /create an account/i],
    expectedPatterns: [/indeed/i],
  },
  {
    name: "wellfound",
    url: "https://wellfound.com/jobs",
    loginPatterns: [/log in/i, /sign up/i],
    expectedPatterns: [/wellfound|jobs/i],
  },
];

function profilePreferencesPath() {
  return path.join(chromeUserDataDir, workProfileDirectory, "Preferences");
}

function profileEmails() {
  const preferencesPath = profilePreferencesPath();
  if (!fs.existsSync(preferencesPath)) {
    throw new Error(
      `Chrome profile preferences not found for ${workProfileDirectory}`,
    );
  }

  const prefs = JSON.parse(fs.readFileSync(preferencesPath, "utf8")) as {
    account_info?: { email?: string }[];
    signin?: { accounts_metadata_dict?: Record<string, { email?: string }> };
  };
  const emails = new Set<string>();
  for (const account of prefs.account_info ?? []) {
    if (account.email) {
      emails.add(account.email);
    }
  }

  for (const metadata of Object.values(
    prefs.signin?.accounts_metadata_dict ?? {},
  )) {
    if (metadata.email) {
      emails.add(metadata.email);
    }
  }

  return emails;
}

function assertWorkProfile() {
  const emails = profileEmails();
  if (!emails.has(workEmail)) {
    throw new Error(
      `${workProfileDirectory} is not the Moyez Work profile. Expected ${workEmail}; found ${[
        ...emails,
      ].join(", ")}`,
    );
  }
}

function configuredTargets(): LiveTarget[] {
  const rawTargets = process.env.HFM_LIVE_URLS?.trim();
  if (!rawTargets) {
    return defaultTargets;
  }

  return rawTargets.split(",").map((url, index) => ({
    name: `target_${index + 1}`,
    url: url.trim(),
    loginPatterns: [/sign in/i, /log in/i, /login/i, /sign up/i],
  }));
}

function singletonLockExists() {
  try {
    fs.lstatSync(path.join(chromeUserDataDir, "SingletonLock"));
    return true;
  } catch {
    return false;
  }
}

async function launchWorkContext() {
  if (!fs.existsSync(chromeBinary)) {
    throw new Error(`Chrome binary not found: ${chromeBinary}`);
  }

  if (singletonLockExists()) {
    throw new Error(
      [
        "Chrome is already running, so the live verifier cannot safely open the Moyez Work profile files.",
        `Quit Chrome fully, then rerun npm run verify:live:chrome so it can launch ${workProfileDirectory} (${workEmail}) directly.`,
      ].join(" "),
    );
  }

  return chromium.launchPersistentContext(chromeUserDataDir, {
    channel: "chrome",
    headless: false,
    executablePath: chromeBinary,
    args: [
      `--profile-directory=${workProfileDirectory}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
}

async function readHealth() {
  const response = await fetch("http://localhost:3000/api/health");
  if (!response.ok) {
    throw new Error(`Local app health check failed: ${response.status}`);
  }
}

await readHealth();
assertWorkProfile();

const context = await launchWorkContext();

const results = [];
for (const target of configuredTargets()) {
  const page = await context.newPage();
  try {
    await page.goto(target.url, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
      // Many job boards keep long-polling connections open.
    });

    const title = await page.title();
    const bodyText = await page
      .locator("body")
      .innerText({ timeout: 10000 })
      .catch(() => "");
    const normalizedText = `${title}\n${bodyText}`;
    const loginDetected = target.loginPatterns.some((pattern) =>
      pattern.test(normalizedText),
    );
    const expectedDetected =
      !target.expectedPatterns ||
      target.expectedPatterns.some((pattern) => pattern.test(normalizedText));

    results.push({
      name: target.name,
      url: page.url(),
      title,
      authenticated: !loginDetected,
      expectedContent: expectedDetected,
    });
  } catch (error) {
    results.push({
      name: target.name,
      url: target.url,
      title: "",
      authenticated: false,
      expectedContent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    await page.close().catch(() => {});
  }
}

await context.close();

const failed = results.filter(
  (result) => !result.authenticated || !result.expectedContent,
);
if (failed.length > 0) {
  throw new Error(
    `Live Chrome smoke failed for: ${failed
      .map((result) => result.name)
      .join(", ")}`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      profileDirectory: workProfileDirectory,
      profileEmail: workEmail,
      targets: results,
    },
    null,
    2,
  ),
);
