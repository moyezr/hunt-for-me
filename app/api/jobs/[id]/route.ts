import { updateJob } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { readRequestBody } from "@/lib/request";
import type { JobStatus } from "@/lib/types";
import { isJobStatus } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await readRequestBody<{
      status?: JobStatus;
      notes?: string;
    }>(request);

    if (body.status && !isJobStatus(body.status)) {
      return jsonError("Invalid job status", 400);
    }

    return jsonOk({
      job: updateJob({
        id,
        status: body.status,
        notes: body.notes,
      }),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to update job",
      500,
    );
  }
}
