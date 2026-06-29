import { parseCsvObjects } from "@/lib/csv";
import { createContact } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { readRequestBody } from "@/lib/request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readRequestBody<{
      csv?: string;
    }>(request);

    if (!body.csv?.trim()) {
      return jsonError("CSV content is required", 400);
    }

    const rows = parseCsvObjects(body.csv);
    const imported = [];
    const skipped = [];

    for (const row of rows) {
      const name = row.name;
      const title = row.title;
      const company = row.company;

      if (!name || !title || !company) {
        skipped.push(row);
        continue;
      }

      imported.push(
        createContact({
          name,
          title,
          company,
          platform: row.platform || "linkedin",
          profileUrl: row.profile_url || row.profile || "",
          status: "new",
          notes: row.notes || "",
        }),
      );
    }

    return jsonOk({
      imported: imported.length,
      skipped: skipped.length,
      contacts: imported,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to import contacts",
      500,
    );
  }
}
