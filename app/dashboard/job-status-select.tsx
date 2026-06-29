"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { JobStatus } from "@/lib/types";

const statuses: JobStatus[] = [
  "discovered",
  "applied",
  "interviewing",
  "rejected",
  "offer",
];

export function JobStatusSelect({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [isSaving, setIsSaving] = useState(false);

  async function updateStatus(nextStatus: JobStatus) {
    setValue(nextStatus);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Status update failed");
      }

      router.refresh();
    } catch {
      setValue(status);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <select
      className="rounded-full bg-[#e7f6f3] px-2 py-1 text-xs font-medium text-[var(--accent-strong)] disabled:opacity-60"
      disabled={isSaving}
      onChange={(event) => updateStatus(event.target.value as JobStatus)}
      value={value}
    >
      {statuses.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}
