import { jsonError, jsonOk } from "@/lib/http";
import { scrapeSeedJobs } from "@/lib/scraper";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      query?: string;
      location?: string;
    };

    const saved = await scrapeSeedJobs(body);

    return jsonOk({
      jobs: saved,
      note: "Seed scraper is wired. Live Playwright scrapers for Naukri, Indeed, and Wellfound are the next implementation layer.",
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to scrape jobs",
      500,
    );
  }
}
