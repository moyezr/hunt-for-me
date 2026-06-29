"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const sampleCsv =
  "name,title,company,platform,profile_url,notes\nAsha,Founder,Acme AI,linkedin,https://linkedin.com/in/asha,building AI workflows";

export function ContactImport() {
  const router = useRouter();
  const [csv, setCsv] = useState(sampleCsv);
  const [message, setMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  async function importContacts() {
    setIsImporting(true);
    setMessage("Importing contacts...");

    try {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Import failed");
      }

      setMessage(
        `Imported ${payload.data.imported} contact(s). Skipped ${payload.data.skipped}.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
      <textarea
        className="min-h-28 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        onChange={(event) => setCsv(event.target.value)}
        value={csv}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:bg-[#a0a7b7]"
          disabled={isImporting}
          onClick={importContacts}
          type="button"
        >
          Import contacts
        </button>
        {message ? (
          <p className="text-sm text-[var(--muted)]">{message}</p>
        ) : null}
      </div>
    </section>
  );
}
