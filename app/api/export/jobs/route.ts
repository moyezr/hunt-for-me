import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { getJobs } from "@/lib/db";

export const runtime = "nodejs";

export function GET() {
  const rows = getJobs();
  const csv = toCsv([
    [
      "id",
      "title",
      "company",
      "url",
      "platform",
      "fit_score",
      "status",
      "applied_at",
      "notes",
      "created_at",
    ],
    ...rows.map((job) => [
      job.id,
      job.title,
      job.company,
      job.url,
      job.platform,
      job.fitScore ?? "",
      job.status,
      job.appliedAt ?? "",
      job.notes,
      job.createdAt,
    ]),
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hunt-for-me-jobs.csv"',
    },
  });
}
