import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { getContacts } from "@/lib/db";

export const runtime = "nodejs";

export function GET() {
  const rows = getContacts();
  const csv = toCsv([
    [
      "id",
      "name",
      "title",
      "company",
      "platform",
      "profile_url",
      "status",
      "latest_message",
      "follow_up_date",
      "notes",
      "created_at",
    ],
    ...rows.map((contact) => [
      contact.id,
      contact.name,
      contact.title,
      contact.company,
      contact.platform,
      contact.profileUrl,
      contact.status,
      contact.messageHistory.at(-1)?.body ?? "",
      contact.followUpDate ?? "",
      contact.notes,
      contact.createdAt,
    ]),
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hunt-for-me-contacts.csv"',
    },
  });
}
