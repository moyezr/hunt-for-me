"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardActions() {
  const router = useRouter();
  const [query, setQuery] = useState("AI Engineer");
  const [location, setLocation] = useState("India Remote");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function triggerScrape() {
    setIsLoading(true);
    setStatus("Scraping and scoring jobs...");

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, location }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Scrape failed");
      }

      setStatus(`Saved ${payload.data.jobs.length} matching job(s).`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Scrape failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-3 md:grid-cols-[180px_180px_auto]">
      <input
        className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        onChange={(event) => setQuery(event.target.value)}
        value={query}
      />
      <input
        className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
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
      {status ? (
        <p className="text-sm text-[var(--muted)] md:col-span-3">{status}</p>
      ) : null}
    </div>
  );
}
