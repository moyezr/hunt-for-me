import { generateAnswer } from "@/lib/ai";
import { jsonError, jsonOk } from "@/lib/http";
import { readRequestBody } from "@/lib/request";
import type { AnswerRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readRequestBody<AnswerRequest>(request);

    if (!body.question?.trim()) {
      return jsonError("Question is required", 400);
    }

    if (!body.company?.trim()) {
      return jsonError("Company name is required", 400);
    }

    if (!body.role?.trim()) {
      return jsonError("Role is required", 400);
    }

    const answer = await generateAnswer({
      question: body.question,
      company: body.company,
      role: body.role,
      jdText: body.jdText,
      jobUrl: body.jobUrl,
    });

    return jsonOk(answer);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate answer",
      500,
    );
  }
}
