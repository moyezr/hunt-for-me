import { createJob, getJobs } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { readRequestBody } from "@/lib/request";
import type { JobStatus } from "@/lib/types";
import { isJobFitScore, isJobStatus } from "@/lib/validation";

export const runtime = "nodejs";

export function GET() {
  try {
    return jsonOk({ jobs: getJobs() });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load jobs",
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await readRequestBody<{
      title?: string;
      company?: string;
      url?: string;
      platform?: string;
      jdText?: string;
      fitScore?: number;
      status?: JobStatus;
      notes?: string;
    }>(request);

    if (!body.title?.trim()) {
      return jsonError("Title is required", 400);
    }

    if (!body.company?.trim()) {
      return jsonError("Company is required", 400);
    }

    if (body.status && !isJobStatus(body.status)) {
      return jsonError("Invalid job status", 400);
    }

    if (body.fitScore !== undefined && !isJobFitScore(body.fitScore)) {
      return jsonError("Fit score must be an integer from 1 to 10", 400);
    }

    const result = createJob({
      title: body.title,
      company: body.company,
      url: body.url ?? "",
      platform: body.platform ?? "manual",
      jdText: body.jdText,
      fitScore: body.fitScore,
      status: body.status,
      notes: body.notes,
    });

    if (result.duplicate) {
      return jsonError(
        "A non-discovered application for this company and title already exists",
        409,
      );
    }

    return jsonOk({ job: result.job }, 201);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to save job",
      500,
    );
  }
}
