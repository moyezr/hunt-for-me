"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ScrapePlatform } from "@/lib/scraper";

const scrapePlatforms: ScrapePlatform[] = ["naukri", "indeed", "wellfound"];

export function DashboardActions() {
  const router = useRouter();
  const [query, setQuery] = useState("AI Engineer");
  const [location, setLocation] = useState("India Remote");
  const [maxPerPlatform, setMaxPerPlatform] = useState(8);
  const [platforms, setPlatforms] = useState<ScrapePlatform[]>(scrapePlatforms);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<{ platform: string; error: string }[]>(
    [],
  );
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
    setErrors([]);

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

      setErrors(payload.data.errors);
      const errorText = payload.data.errors.length
        ? ` ${payload.data.errors.length} platform error(s).`
        : "";
      setStatus(
        `Scanned ${payload.data.scanned} job(s). Saved ${payload.data.jobs.length}. Skipped ${payload.data.skippedLowFit} low-fit and ${payload.data.duplicates} duplicate job(s).${errorText}`,
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Scrape failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-3 md:grid-cols-[180px_180px_150px_auto]">
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
      <div className="flex flex-wrap gap-3 md:col-span-4">
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
      {status ? (
        <p className="text-sm text-[var(--muted)] md:col-span-4">{status}</p>
      ) : null}
      {errors.length > 0 ? (
        <div className="grid gap-1 text-sm text-[var(--muted)] md:col-span-4">
          {errors.map((error) => (
            <p key={error.platform}>
              {error.platform}: {error.error}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
