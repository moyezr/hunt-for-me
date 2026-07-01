"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ScrapePlatform } from "@/lib/scraper";

const scrapePlatforms: ScrapePlatform[] = ["naukri", "indeed", "wellfound"];

type ScrapeResult = {
  saved: number;
  skippedLowFit: number;
  duplicates: number;
  errors: { platform: string; error: string }[];
  scanned: number;
};

export function DashboardActions() {
  const router = useRouter();
  const [query, setQuery] = useState("AI Engineer");
  const [location, setLocation] = useState("India Remote");
  const [maxPerPlatform, setMaxPerPlatform] = useState(8);
  const [platforms, setPlatforms] = useState<ScrapePlatform[]>(scrapePlatforms);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function togglePlatform(platform: ScrapePlatform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  }

  async function triggerScrape() {
    if (platforms.length === 0) {
      setStatus("Select at least one platform.");
      return;
    }

    setIsLoading(true);
    setStatus("Scraping and scoring jobs...");
    setResult(null);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, location, platforms, maxPerPlatform }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Scrape failed");
      }

      setResult({
        saved: payload.data.jobs.length,
        skippedLowFit: payload.data.skippedLowFit,
        duplicates: payload.data.duplicates,
        errors: payload.data.errors,
        scanned: payload.data.scanned,
      });
      setStatus("Scrape complete.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Scrape failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Scraper run</h2>
          <p className="text-sm text-[var(--muted)]">
            Pull high-fit jobs into the dashboard, then work the saved queue.
          </p>
        </div>
        {status ? (
          <p className="text-sm text-[var(--muted)]">{status}</p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-[180px_180px_150px_auto]">
        <input
          className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          aria-label="Role query"
          onChange={(event) => setQuery(event.target.value)}
          value={query}
        />
        <input
          className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          aria-label="Location"
          onChange={(event) => setLocation(event.target.value)}
          value={location}
        />
        <input
          className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          aria-label="Max jobs per platform"
          min={1}
          max={20}
          onChange={(event) => setMaxPerPlatform(Number(event.target.value))}
          type="number"
          value={maxPerPlatform}
        />
        <button
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:bg-[#a0a7b7]"
          disabled={isLoading}
          onClick={triggerScrape}
          type="button"
        >
          Trigger scraper
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {scrapePlatforms.map((platform) => (
          <label className="flex items-center gap-2 text-sm" key={platform}>
            <input
              checked={platforms.includes(platform)}
              onChange={() => togglePlatform(platform)}
              type="checkbox"
            />
            {platform}
          </label>
        ))}
      </div>
      {result ? (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-[var(--line)] p-3">
              <p className="text-sm text-[var(--muted)]">Scanned</p>
              <p className="mt-1 text-xl font-semibold">{result.scanned}</p>
            </div>
            <div className="rounded-md border border-[var(--line)] p-3">
              <p className="text-sm text-[var(--muted)]">Saved</p>
              <p className="mt-1 text-xl font-semibold">{result.saved}</p>
            </div>
            <div className="rounded-md border border-[var(--line)] p-3">
              <p className="text-sm text-[var(--muted)]">Duplicates</p>
              <p className="mt-1 text-xl font-semibold">{result.duplicates}</p>
            </div>
            <div className="rounded-md border border-[var(--line)] p-3">
              <p className="text-sm text-[var(--muted)]">Low-fit skipped</p>
              <p className="mt-1 text-xl font-semibold">
                {result.skippedLowFit}
              </p>
            </div>
          </div>
          {result.errors.length > 0 ? (
            <div className="grid gap-2 rounded-md border border-[var(--line)] bg-[#fff8ed] p-3 text-sm">
              <p className="font-medium">Platform diagnostics</p>
              {result.errors.map((error) => (
                <p className="text-[var(--muted)]" key={error.platform}>
                  {error.platform}: {error.error}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
