import { jsonError, jsonOk } from "@/lib/http";
import {
  getOutreachTemplates,
  writeOutreachTemplates,
} from "@/lib/outreach-templates";
import { readRequestBody } from "@/lib/request";

export const runtime = "nodejs";

export function GET() {
  try {
    return jsonOk({ config: getOutreachTemplates() });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load templates",
      500,
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readRequestBody<{ config?: unknown }>(request);

    if (!body.config) {
      return jsonError("Template config is required", 400);
    }

    return jsonOk({ config: writeOutreachTemplates(body.config) });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to save templates",
      400,
    );
  }
}
