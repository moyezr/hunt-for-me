"use client";

import { useState } from "react";
import type { OutreachTemplateConfig } from "@/lib/types";

export function OutreachTemplateEditor({
  initialConfig,
}: {
  initialConfig: OutreachTemplateConfig;
}) {
  const [rawConfig, setRawConfig] = useState(
    JSON.stringify(initialConfig, null, 2),
  );
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveTemplates() {
    setIsSaving(true);
    setStatus("Saving templates...");

    try {
      const config = JSON.parse(rawConfig) as unknown;
      const response = await fetch("/api/outreach/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Could not save templates");
      }

      setRawConfig(JSON.stringify(payload.data.config, null, 2));
      setStatus("Templates saved.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not save templates",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Outreach templates</h2>
          <p className="text-sm text-[var(--muted)]">
            Channel-specific templates used by the AI writer.
          </p>
        </div>
        <button
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:bg-[#a0a7b7]"
          disabled={isSaving}
          onClick={saveTemplates}
          type="button"
        >
          Save templates
        </button>
      </div>
      <textarea
        className="min-h-80 rounded-md border border-[var(--line)] px-3 py-2 font-mono text-xs"
        onChange={(event) => setRawConfig(event.target.value)}
        spellCheck={false}
        value={rawConfig}
      />
      {status ? <p className="text-sm text-[var(--muted)]">{status}</p> : null}
    </section>
  );
}
