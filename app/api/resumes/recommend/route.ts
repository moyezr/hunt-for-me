import { jsonError, jsonOk } from "@/lib/http";
import { readRequestBody } from "@/lib/request";
import { recommendResume } from "@/lib/resumes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readRequestBody<{
      role?: string;
      jdText?: string;
    }>(request);

    return jsonOk({
      resume: recommendResume({
        role: body.role,
        jdText: body.jdText,
      }),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to recommend resume",
      500,
    );
  }
}
