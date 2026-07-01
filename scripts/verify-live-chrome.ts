import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

type LiveTarget = {
  name: string;
  url: string;
  loginPatterns: RegExp[];
  expectedPatterns?: RegExp[];
};

const execFileAsync = promisify(execFile);
const workEmail = "moyezrabbani.work@gmail.com";
const workProfileName = "Moyez Work";
const workProfileDirectory =
  process.env.HFM_CHROME_PROFILE_DIRECTORY ?? "Profile 1";
const chromeUserDataDir = path.join(
  process.env.HOME ?? "",
  "Library",
  "Application Support",
  "Google",
  "Chrome",
);

const defaultTargets: LiveTarget[] = [
  {
    name: "linkedin",
    url: "https://www.linkedin.com/feed/",
    loginPatterns: [/login/i, /sign in/i, /auth/i],
    expectedPatterns: [/linkedin/i],
  },
  {
    name: "naukri",
    url: "https://www.naukri.com/mnjuser/homepage",
    loginPatterns: [/login/i, /nlogin/i, /register/i],
    expectedPatterns: [/naukri/i],
  },
  {
    name: "indeed",
    url: "https://profile.indeed.com/",
    loginPatterns: [/login/i, /sign in/i, /auth/i],
    expectedPatterns: [/indeed/i],
  },
  {
    name: "wellfound",
    url: "https://wellfound.com/jobs",
    loginPatterns: [/login/i, /sign in/i, /sign up/i],
    expectedPatterns: [/wellfound|jobs/i],
  },
];

function profilePreferencesPath() {
  return path.join(chromeUserDataDir, workProfileDirectory, "Preferences");
}

function localStatePath() {
  return path.join(chromeUserDataDir, "Local State");
}

function profileMetadata() {
  const preferencesPath = profilePreferencesPath();
  if (!fs.existsSync(preferencesPath)) {
    throw new Error(
      `Chrome profile preferences not found for ${workProfileDirectory}`,
    );
  }

  const localState = fs.existsSync(localStatePath())
    ? (JSON.parse(fs.readFileSync(localStatePath(), "utf8")) as {
        profile?: {
          info_cache?: Record<
            string,
            { name?: string; user_name?: string; gaia_name?: string }
          >;
        };
      })
    : undefined;
  const prefs = JSON.parse(fs.readFileSync(preferencesPath, "utf8")) as {
    account_info?: { email?: string }[];
    profile?: { name?: string };
    signin?: { accounts_metadata_dict?: Record<string, { email?: string }> };
  };
  const profileInfo = localState?.profile?.info_cache?.[workProfileDirectory];
  const profileName = profileInfo?.name ?? prefs.profile?.name ?? "";
  const emails = new Set<string>();
  if (profileInfo?.user_name) {
    emails.add(profileInfo.user_name);
  }
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

  return { emails, profileName };
}

function assertWorkProfile() {
  const { emails, profileName } = profileMetadata();
  if (profileName !== workProfileName && !emails.has(workEmail)) {
    throw new Error(
      `${workProfileDirectory} is not the ${workProfileName} profile. Expected profile name ${workProfileName} or email ${workEmail}; found profile name "${profileName}" and emails "${[
        ...emails,
      ].join(", ")}"`,
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
    loginPatterns: [/sign in/i, /log in/i, /login/i, /sign up/i, /auth/i],
  }));
}

async function chromeIsRunning() {
  try {
    await execFileAsync("pgrep", ["-x", "Google Chrome"]);
    return true;
  } catch {
    return false;
  }
}

async function runAppleScript(script: string) {
  const { stdout } = await execFileAsync("osascript", ["-e", script], {
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function launchWorkChrome() {
  if (await chromeIsRunning()) {
    throw new Error(
      `Chrome is already running. Quit Chrome fully, then rerun npm run verify:live:chrome so the script can open ${workProfileDirectory} (${workEmail}).`,
    );
  }

  await execFileAsync("open", [
    "-na",
    "Google Chrome",
    "--args",
    `--profile-directory=${workProfileDirectory}`,
    "about:blank",
  ]);

  const started = Date.now();
  while (Date.now() - started < 15000) {
    const windowCount = await runAppleScript(
      'tell application "Google Chrome" to count windows',
    ).catch(() => "0");
    if (Number(windowCount) > 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Chrome did not open a window for the work profile");
}

function escapeAppleScriptText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function navigateActiveTab(url: string) {
  await runAppleScript(`
    tell application "Google Chrome"
      activate
      if (count windows) is 0 then make new window
      set URL of active tab of front window to "${escapeAppleScriptText(url)}"
    end tell
  `);
}

async function activeTabState() {
  const raw = await runAppleScript(`
    tell application "Google Chrome"
      set currentUrl to URL of active tab of front window
      set currentTitle to title of active tab of front window
      return currentUrl & linefeed & currentTitle
    end tell
  `);
  const [url = "", ...titleParts] = raw.split("\n");
  return {
    url,
    title: titleParts.join("\n"),
  };
}

async function waitForNavigation(target: LiveTarget) {
  const started = Date.now();
  let lastState = { url: "", title: "" };

  while (Date.now() - started < 45000) {
    lastState = await activeTabState();
    const text = `${lastState.url}\n${lastState.title}`;
    const expectedDetected =
      !target.expectedPatterns ||
      target.expectedPatterns.some((pattern) => pattern.test(text));
    const isStillBlank =
      lastState.url === "" ||
      lastState.url === "about:blank" ||
      lastState.title === "";

    if (!isStillBlank && expectedDetected) {
      return lastState;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return lastState;
}

async function readHealth() {
  const response = await fetch("http://localhost:3000/api/health");
  if (!response.ok) {
    throw new Error(`Local app health check failed: ${response.status}`);
  }
}

await readHealth();
assertWorkProfile();

console.log(
  `Opening Chrome ${workProfileDirectory} (${workEmail}) for live smoke...`,
);
await launchWorkChrome();

const results = [];
for (const target of configuredTargets()) {
  console.log(`Checking ${target.name}: ${target.url}`);
  try {
    await navigateActiveTab(target.url);
    const state = await waitForNavigation(target);
    const text = `${state.url}\n${state.title}`;
    const loginDetected = target.loginPatterns.some((pattern) =>
      pattern.test(text),
    );
    const expectedDetected =
      !target.expectedPatterns ||
      target.expectedPatterns.some((pattern) => pattern.test(text));

    results.push({
      name: target.name,
      url: state.url,
      title: state.title,
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
  }
}

await runAppleScript('tell application "Google Chrome" to quit').catch(
  () => {},
);

const failed = results.filter(
  (result) => !result.authenticated || !result.expectedContent,
);
if (failed.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        profileDirectory: workProfileDirectory,
        profileEmail: workEmail,
        targets: results,
      },
      null,
      2,
    ),
  );
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
