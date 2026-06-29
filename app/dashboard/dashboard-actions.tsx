"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ScrapePlatform } from "@/lib/scraper";

const scrapePlatforms: ScrapePlatform[] = ["naukri", "indeed", "wellfound"];

export function DashboardActions() {
  const router = useRouter();
  const [query, setQuery] = useState("AI Engineer");
  const [location, setLocation] = useState("India Remote");
  const [platforms, setPlatforms] = useState<ScrapePlatform[]>(scrapePlatforms);
  const [status, setStatus] = useState("");
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

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, location, platforms }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Scrape failed");
      }

      const errorText = payload.data.errors.length
        ? ` ${payload.data.errors.length} platform error(s).`
        : "";
      setStatus(
        `Saved ${payload.data.jobs.length} matching job(s). Skipped ${payload.data.skippedLowFit} low-fit job(s).${errorText}`,
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Scrape failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-3 md:grid-cols-[180px_180px_auto]">
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
      <button
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:bg-[#a0a7b7]"
        disabled={isLoading}
        onClick={triggerScrape}
        type="button"
      >
        Trigger scraper
      </button>
      <div className="flex flex-wrap gap-3 md:col-span-3">
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
        <p className="text-sm text-[var(--muted)] md:col-span-3">{status}</p>
      ) : null}
    </div>
  );
}
