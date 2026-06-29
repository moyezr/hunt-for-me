"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { JobStatus } from "@/lib/types";

type RecommendedResume = {
  label: string;
  filename: string;
  relativePath: string;
  reason: string;
  exists: boolean;
};

export function ManualJobForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<JobStatus>("discovered");
  const [jdText, setJdText] = useState("");
  const [message, setMessage] = useState("");
  const [resume, setResume] = useState<RecommendedResume | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveJob() {
    if (!title.trim() || !company.trim()) {
      setMessage("Title and company are required.");
      return;
    }

    setIsSaving(true);
    setMessage("Saving job...");
    setResume(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          company,
          url,
          platform: "manual",
          status,
          jdText,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Could not save job");
      }

      const resumeResponse = await fetch("/api/resumes/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: title, jdText }),
      });
      const resumePayload = await resumeResponse.json();

      if (resumeResponse.ok && resumePayload.ok) {
        setResume(resumePayload.data.resume);
      }

      setMessage(
        status === "applied"
          ? "Saved and marked applied."
          : "Saved to discovered jobs.",
      );
      setTitle("");
      setCompany("");
      setUrl("");
      setJdText("");
      setStatus("discovered");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save job");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px]">
        <input
          aria-label="Job title"
          className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Role title"
          value={title}
        />
        <input
          aria-label="Company"
          className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          onChange={(event) => setCompany(event.target.value)}
          placeholder="Company"
          value={company}
        />
        <select
          aria-label="Initial status"
          className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          onChange={(event) => setStatus(event.target.value as JobStatus)}
          value={status}
        >
          <option value="discovered">discovered</option>
          <option value="applied">applied</option>
        </select>
      </div>
      <input
        aria-label="Job URL"
        className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        onChange={(event) => setUrl(event.target.value)}
        placeholder="Job URL"
        value={url}
      />
      <textarea
        aria-label="Job description"
        className="min-h-28 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        onChange={(event) => setJdText(event.target.value)}
        placeholder="Paste JD text for answer context and resume recommendation"
        value={jdText}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:bg-[#a0a7b7]"
          disabled={isSaving}
          onClick={saveJob}
          type="button"
        >
          Save job
        </button>
        {message ? (
          <p className="text-sm text-[var(--muted)]">{message}</p>
        ) : null}
      </div>
      {resume ? (
        <div className="rounded-md border border-[#b9dfd8] bg-[#eef7f5] p-3">
          <p className="text-sm font-semibold">{resume.label} resume</p>
          <p className="text-sm text-[var(--muted)]">
            {resume.filename} ·{" "}
            {resume.exists ? resume.relativePath : "file missing"}
          </p>
          <p className="text-sm text-[var(--muted)]">{resume.reason}</p>
        </div>
      ) : null}
    </section>
  );
}
