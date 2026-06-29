"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Contact, OutreachMessage } from "@/lib/types";

type Draft = {
  contact: Contact;
  message: OutreachMessage;
};

export function OutreachBatch() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [companyContext, setCompanyContext] = useState("");
  const [channel, setChannel] =
    useState<OutreachMessage["channel"]>("linkedin_note");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function draftMessage() {
    setIsLoading(true);
    setStatus("Drafting message...");

    try {
      const response = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          title,
          company,
          companyContext,
          channel,
          platform: channel.startsWith("linkedin") ? "linkedin" : "twitter",
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Message draft failed");
      }

      setDraft(payload.data);
      setStatus("Draft ready. Edit, copy, or mark sent.");
      router.refresh();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Message draft failed",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyDraft() {
    if (!draft) {
      return;
    }

    await navigator.clipboard.writeText(draft.message.body);
    setStatus("Copied.");
  }

  async function markSent() {
    if (!draft) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/contacts/${draft.contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "sent",
          messageBody: draft.message.body,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Could not mark sent");
      }

      setStatus("Marked sent. Follow-up set for 3 days from now.");
      setDraft(null);
      setName("");
      setTitle("");
      setCompany("");
      setCompanyContext("");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not mark sent");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <label className="grid gap-1 text-sm">
          Name
          <input
            className="rounded-md border border-[var(--line)] px-3 py-2"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Title
          <input
            className="rounded-md border border-[var(--line)] px-3 py-2"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Company
          <input
            className="rounded-md border border-[var(--line)] px-3 py-2"
            onChange={(event) => setCompany(event.target.value)}
            value={company}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Channel
          <select
            className="rounded-md border border-[var(--line)] px-3 py-2"
            onChange={(event) =>
              setChannel(event.target.value as OutreachMessage["channel"])
            }
            value={channel}
          >
            <option value="linkedin_note">LinkedIn note</option>
            <option value="linkedin_dm">LinkedIn DM</option>
            <option value="twitter_dm">Twitter DM</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Company context
          <textarea
            className="min-h-24 rounded-md border border-[var(--line)] px-3 py-2"
            onChange={(event) => setCompanyContext(event.target.value)}
            value={companyContext}
          />
        </label>
        <button
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:bg-[#a0a7b7]"
          disabled={isLoading}
          onClick={draftMessage}
          type="button"
        >
          Draft message
        </button>
        {status ? (
          <p className="text-sm text-[var(--muted)]">{status}</p>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <h2 className="font-semibold">Current draft</h2>
        <textarea
          className="min-h-44 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          disabled={!draft}
          onChange={(event) => {
            if (!draft) {
              return;
            }
            setDraft({
              ...draft,
              message: { ...draft.message, body: event.target.value },
            });
          }}
          value={draft?.message.body ?? ""}
        />
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium disabled:text-[#a0a7b7]"
            disabled={!draft}
            onClick={copyDraft}
            type="button"
          >
            Copy
          </button>
          <button
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:bg-[#a0a7b7]"
            disabled={!draft || isLoading}
            onClick={markSent}
            type="button"
          >
            Mark sent
          </button>
        </div>
      </div>
    </section>
  );
}
