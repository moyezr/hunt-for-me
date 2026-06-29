import { createJob } from "@/lib/db";
import { getProfile } from "@/lib/profile";

export type ScrapeInput = {
  query?: string;
  location?: string;
};

export type ScrapedJob = {
  title: string;
  company: string;
  url: string;
  platform: string;
  jdText: string;
  fitScore: number;
};

export function scoreJob(jdText: string) {
  const profile = getProfile();
  const text = jdText.toLowerCase();
  const matched = profile.skills.filter((skill) =>
    text.includes(skill.toLowerCase()),
  );
  const roleMatched = profile.preferredRoles.some((role) =>
    text.includes(role.toLowerCase()),
  );
  const score = Math.min(
    10,
    Math.max(1, Math.ceil(matched.length / 1.5) + (roleMatched ? 2 : 0)),
  );

  return {
    score,
    matchedSkills: matched,
  };
}

export async function scrapeSeedJobs(input: ScrapeInput) {
  const query = input.query?.trim() || "AI Engineer";
  const location = input.location?.trim() || "India Remote";
  const jdText = `Hiring ${query} in ${location}. Looking for Next.js, TypeScript, LLM applications, RAG, Python, Redis, Docker, Azure, and product ownership.`;
  const scored = scoreJob(jdText);

  const jobs: ScrapedJob[] = [
    {
      title: query,
      company: "Example AI Startup",
      url: "https://example.com/careers",
      platform: "manual-seed",
      jdText,
      fitScore: scored.score,
    },
  ];

  return jobs
    .filter((job) => job.fitScore >= 6)
    .map((job) => createJob(job).job);
}
