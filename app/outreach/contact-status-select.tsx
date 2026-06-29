"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ContactStatus } from "@/lib/types";

const statuses: ContactStatus[] = [
  "new",
  "drafted",
  "sent",
  "follow_up_due",
  "responded",
  "closed",
];

export function ContactStatusSelect({
  contactId,
  status,
}: {
  contactId: string;
  status: ContactStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [isSaving, setIsSaving] = useState(false);

  async function updateStatus(nextStatus: ContactStatus) {
    setValue(nextStatus);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Contact status update failed");
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
      aria-label="Contact status"
      className="rounded-full bg-[#e7f6f3] px-2 py-1 text-xs font-medium text-[var(--accent-strong)] disabled:opacity-60"
      disabled={isSaving}
      onChange={(event) => updateStatus(event.target.value as ContactStatus)}
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
