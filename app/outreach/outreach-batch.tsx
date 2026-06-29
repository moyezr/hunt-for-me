"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Contact, OutreachMessage } from "@/lib/types";

type Draft = {
  contact: Contact;
  message: OutreachMessage;
};

type QueueContact = {
  id?: string;
  name: string;
  title: string;
  company: string;
  companyContext: string;
  profileUrl: string;
};

function parseQueue(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [
        name = "",
        title = "",
        company = "",
        companyContext = "",
        profileUrl = "",
      ] = line.split("|").map((part) => part.trim());

      return {
        name,
        title,
        company,
        companyContext,
        profileUrl,
      };
    })
    .filter((contact) => contact.name && contact.title && contact.company);
}

export function OutreachBatch({
  savedContacts = [],
}: {
  savedContacts?: Contact[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [companyContext, setCompanyContext] = useState("");
  const [channel, setChannel] =
    useState<OutreachMessage["channel"]>("linkedin_note");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [queueText, setQueueText] = useState("");
  const [queue, setQueue] = useState<QueueContact[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function activeQueueContact(nextQueue = queue, nextIndex = queueIndex) {
    return nextQueue[nextIndex] ?? null;
  }

  function loadQueue() {
    const parsed = parseQueue(queueText);
    setQueue(parsed);
    setQueueIndex(0);
    setSentCount(0);
    setDraft(null);

    const first = parsed[0];
    if (first) {
      setName(first.name);
      setTitle(first.title);
      setCompany(first.company);
      setCompanyContext(first.companyContext);
      setStatus(`${parsed.length} contact(s) queued.`);
    } else {
      setStatus(
        "Paste rows as: name | title | company | context | profile URL",
      );
    }
  }

  function loadSavedContacts() {
    const contacts = savedContacts
      .filter(
        (contact) => contact.status !== "sent" && contact.status !== "closed",
      )
      .map((contact) => ({
        id: contact.id,
        name: contact.name,
        title: contact.title,
        company: contact.company,
        companyContext: contact.notes,
        profileUrl: contact.profileUrl,
      }));

    setQueue(contacts);
    setQueueIndex(0);
    setSentCount(0);
    setDraft(null);

    const first = contacts[0];
    if (first) {
      setName(first.name);
      setTitle(first.title);
      setCompany(first.company);
      setCompanyContext(first.companyContext);
      setStatus(`${contacts.length} saved contact(s) queued.`);
    } else {
      setStatus("No saved contacts ready for drafting.");
    }
  }

  function loadContact(contact: QueueContact | null) {
    setName(contact?.name ?? "");
    setTitle(contact?.title ?? "");
    setCompany(contact?.company ?? "");
    setCompanyContext(contact?.companyContext ?? "");
  }

  function advanceQueue(nextSentCount = sentCount) {
    const nextIndex = queueIndex + 1;
    setQueueIndex(nextIndex);
    const nextContact = activeQueueContact(queue, nextIndex);
    loadContact(nextContact);
    setDraft(null);

    if (nextContact) {
      setStatus(`Next: ${nextContact.name} at ${nextContact.company}`);
    } else if (queue.length > 0) {
      setStatus(`Batch complete. ${nextSentCount} marked sent.`);
    }
  }

  async function draftMessage() {
    setIsLoading(true);
    setStatus("Drafting message...");
    const queuedContact = activeQueueContact();

    try {
      const endpoint = queuedContact?.id
        ? `/api/contacts/${queuedContact.id}/message`
        : "/api/message";
      const requestBody = queuedContact?.id
        ? {
            channel,
            companyContext: companyContext || queuedContact.companyContext,
          }
        : {
            name,
            title,
            company,
            companyContext,
            channel,
            platform: channel.startsWith("linkedin") ? "linkedin" : "twitter",
            profileUrl: queuedContact?.profileUrl ?? "",
          };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
      const nextSentCount = sentCount + 1;
      setSentCount(nextSentCount);
      advanceQueue(nextSentCount);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not mark sent");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <label className="grid gap-1 text-sm">
          Batch queue
          <textarea
            className="min-h-28 rounded-md border border-[var(--line)] px-3 py-2"
            onChange={(event) => setQueueText(event.target.value)}
            placeholder="Name | Title | Company | Company context | Profile URL"
            value={queueText}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium"
            onClick={loadQueue}
            type="button"
          >
            Load queue
          </button>
          <button
            className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium"
            onClick={loadSavedContacts}
            type="button"
          >
            Load saved contacts
          </button>
          <span className="text-sm text-[var(--muted)]">
            {queue.length > 0
              ? `${queueIndex + 1 > queue.length ? queue.length : queueIndex + 1}/${queue.length} · ${sentCount} sent`
              : "No queue loaded"}
          </span>
        </div>
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
          disabled={isLoading || !name || !title || !company}
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
          <button
            className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium disabled:text-[#a0a7b7]"
            disabled={queue.length === 0 || queueIndex >= queue.length}
            onClick={() => advanceQueue()}
            type="button"
          >
            Skip
          </button>
        </div>
      </div>
    </section>
  );
}
