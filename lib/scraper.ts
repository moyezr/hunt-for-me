import { createJob } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import type { Job } from "@/lib/types";

export type ScrapePlatform = "naukri" | "indeed" | "wellfound";

export type ScrapeInput = {
  query?: string;
  location?: string;
  platforms?: ScrapePlatform[];
  maxPerPlatform?: number;
};

export type ScrapedJob = {
  title: string;
  company: string;
  url: string;
  platform: ScrapePlatform;
  jdText: string;
  fitScore: number;
};

export type ScrapeResult = {
  saved: Job[];
  skippedLowFit: ScrapedJob[];
  errors: { platform: ScrapePlatform; error: string }[];
};

type RawScrapedJob = Omit<ScrapedJob, "fitScore">;

type PlatformConfig = {
  platform: ScrapePlatform;
  buildUrl: (query: string, location: string) => string;
  extract: () => RawScrapedJob[];
};

const defaultPlatforms: ScrapePlatform[] = ["naukri", "indeed", "wellfound"];

const platformConfigs: Record<ScrapePlatform, PlatformConfig> = {
  naukri: {
    platform: "naukri",
    buildUrl: (query, location) => {
      const role = slug(query);
      const place = slug(
        location.replace(/\bremote\b/gi, "").trim() || "india",
      );
      return `https://www.naukri.com/${role}-jobs-in-${place}`;
    },
    extract: () => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".srp-jobtuple-wrapper, article, .jobTuple",
        ),
      );

      return cards.flatMap((card) => {
        const titleLink =
          card.querySelector<HTMLAnchorElement>("a.title") ||
          card.querySelector<HTMLAnchorElement>("a[href*='job-listings']");
        const company =
          card.querySelector(".comp-name")?.textContent?.trim() ||
          card.querySelector(".companyInfo")?.textContent?.trim() ||
          card.querySelector("a[href*='company']")?.textContent?.trim() ||
          "";
        const title = titleLink?.textContent?.trim() || "";
        const href = titleLink?.href || "";
        const jdText = card.innerText.trim();

        return title && company && href
          ? [{ title, company, url: href, platform: "naukri", jdText }]
          : [];
      });
    },
  },
  indeed: {
    platform: "indeed",
    buildUrl: (query, location) =>
      `https://in.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}`,
    extract: () => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".job_seen_beacon, [data-testid='slider_item'], .result",
        ),
      );

      return cards.flatMap((card) => {
        const titleLink =
          card.querySelector<HTMLAnchorElement>("h3 a") ||
          card.querySelector<HTMLAnchorElement>("h2 a") ||
          card.querySelector<HTMLAnchorElement>("a[data-jk]") ||
          card.querySelector<HTMLAnchorElement>("a[href*='/viewjob']") ||
          card.querySelector<HTMLAnchorElement>("a[href*='/rc/clk']");
        const title =
          titleLink?.textContent?.trim() ||
          titleLink
            ?.getAttribute("aria-label")
            ?.replace(/^full details of /i, "") ||
          "";
        const company =
          card
            .querySelector("[data-testid='company-name']")
            ?.textContent?.trim() ||
          card.querySelector(".companyName")?.textContent?.trim() ||
          "";
        const href = titleLink?.href || "";
        const jdText = card.innerText.trim();

        return title && company && href
          ? [{ title, company, url: href, platform: "indeed", jdText }]
          : [];
      });
    },
  },
  wellfound: {
    platform: "wellfound",
    buildUrl: (query, location) =>
      `https://wellfound.com/jobs?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`,
    extract: () => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-test*='Job'], article, div[class*='job']",
        ),
      );

      return cards.flatMap((card) => {
        const titleLink =
          card.querySelector<HTMLAnchorElement>("a[href*='/jobs/']") ||
          card.querySelector<HTMLAnchorElement>("a[href*='job']");
        const companyLink =
          card.querySelector<HTMLAnchorElement>("a[href*='/company/']") ||
          card.querySelector<HTMLAnchorElement>("a[href*='/companies/']");
        const title = titleLink?.textContent?.trim() || "";
        const company = companyLink?.textContent?.trim() || "";
        const href = titleLink?.href || "";
        const jdText = card.innerText.trim();

        return title && company && href
          ? [{ title, company, url: href, platform: "wellfound", jdText }]
          : [];
      });
    },
  },
};

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeQuery(input: ScrapeInput) {
  return {
    query: input.query?.trim() || "AI Engineer",
    location: input.location?.trim() || "India Remote",
    platforms: input.platforms?.length ? input.platforms : defaultPlatforms,
    maxPerPlatform: Math.min(Math.max(input.maxPerPlatform ?? 8, 1), 20),
  };
}

function uniqueJobs(jobs: RawScrapedJob[]) {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = `${job.platform}:${job.company.toLowerCase()}:${job.title.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function randomDelay() {
  const delay = 2000 + Math.floor(Math.random() * 2000);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export function scoreJob(jdText: string) {
  const profile = getProfile();
  const text = jdText.toLowerCase();
  const matched = profile.skills.filter((skill) =>
    text.includes(skill.toLowerCase()),
  );
  const roleMatched = profile.preferredRoles.some((role) =>
    text.includes(role.toLowerCase()),
  );
  const aiRoleMatched = /\b(ai|llm|rag|agent|applied ai)\b/i.test(jdText);
  const score = Math.min(
    10,
    Math.max(
      1,
      Math.ceil(matched.length / 1.5) +
        (roleMatched ? 4 : 0) +
        (aiRoleMatched ? 2 : 0),
    ),
  );

  return {
    score,
    matchedSkills: matched,
  };
}

async function scrapePlatform(config: PlatformConfig, input: ScrapeInput) {
  const { chromium } = await import("playwright");
  const { query, location, maxPerPlatform } = normalizeQuery(input);
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });
    page.setDefaultTimeout(15000);
    await page.goto(config.buildUrl(query, location), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page
      .waitForLoadState("networkidle", { timeout: 10000 })
      .catch(() => {});

    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    if (/access denied|captcha|unusual traffic/i.test(bodyText)) {
      throw new Error("Platform blocked the headless scraper");
    }

    const rawJobs = uniqueJobs(await page.evaluate(config.extract));
    if (rawJobs.length === 0) {
      throw new Error("No job cards found on the results page");
    }

    return rawJobs.slice(0, maxPerPlatform).map((job) => {
      const scored = scoreJob(`${job.title} ${job.company} ${job.jdText}`);
      return { ...job, fitScore: scored.score };
    });
  } finally {
    await browser.close();
  }
}

export async function scrapeJobs(input: ScrapeInput): Promise<ScrapeResult> {
  const normalized = normalizeQuery(input);
  const saved: Job[] = [];
  const skippedLowFit: ScrapedJob[] = [];
  const errors: ScrapeResult["errors"] = [];

  for (const platform of normalized.platforms) {
    try {
      const jobs = await scrapePlatform(platformConfigs[platform], normalized);
      for (const job of jobs) {
        if (job.fitScore < 6) {
          skippedLowFit.push(job);
          continue;
        }

        saved.push(createJob(job).job);
      }
    } catch (error) {
      errors.push({
        platform,
        error: error instanceof Error ? error.message : "Unknown scrape error",
      });
    }

    await randomDelay();
  }

  return { saved, skippedLowFit, errors };
}
