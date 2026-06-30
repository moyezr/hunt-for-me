import { jsonError, jsonOk } from "@/lib/http";
import { type ScrapePlatform, scrapeJobs } from "@/lib/scraper";
import { isScrapePlatform } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      query?: string;
      location?: string;
      platforms?: ScrapePlatform[];
      maxPerPlatform?: number;
    };

    if (
      body.platforms !== undefined &&
      (!Array.isArray(body.platforms) ||
        body.platforms.some((platform) => !isScrapePlatform(platform)))
    ) {
      return jsonError(
        "Invalid scrape platform. Use naukri, indeed, or wellfound",
        400,
      );
    }

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
