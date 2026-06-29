import { jsonError, jsonOk } from "@/lib/http";
import { type ScrapePlatform, scrapeJobs } from "@/lib/scraper";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      query?: string;
      location?: string;
      platforms?: ScrapePlatform[];
      maxPerPlatform?: number;
    };

    const result = await scrapeJobs(body);

    return jsonOk({
      jobs: result.saved,
      skippedLowFit: result.skippedLowFit.length,
      duplicates: result.duplicates.length,
      errors: result.errors,
      scanned: result.scanned,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to scrape jobs",
      500,
    );
  }
}
