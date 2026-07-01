import { generateAnswer } from "@/lib/ai";
import { maxAnswerBatchSize } from "@/lib/batch-limits";
import { jsonError, jsonOk } from "@/lib/http";
import { readRequestBody } from "@/lib/request";
import { isUsableApplicationContext } from "@/lib/validation";

export const runtime = "nodejs";

type BatchQuestion = {
  id?: string;
  question?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readRequestBody<{
      questions?: BatchQuestion[];
      company?: string;
      role?: string;
      jdText?: string;
      jobUrl?: string;
    }>(request);

    if (!body.company?.trim()) {
      return jsonError("Company name is required", 400);
    }

    if (!body.role?.trim()) {
      return jsonError("Role is required", 400);
    }

    if (
      !isUsableApplicationContext({
        company: body.company,
        role: body.role,
      })
    ) {
      return jsonError("Detected company and role are required", 400);
    }

    const questions = body.questions ?? [];
    if (questions.length === 0) {
      return jsonError("At least one question is required", 400);
    }

    if (questions.length > maxAnswerBatchSize) {
      return jsonError(
        `Batch answer requests are capped at ${maxAnswerBatchSize} questions`,
        400,
      );
    }

    const invalidQuestion = questions.find(
      (question) => !question.question?.trim(),
    );
    if (invalidQuestion) {
      return jsonError("Every question must include text", 400);
    }

    const answers = await Promise.all(
      questions.map(async (question, index) => {
        const answer = await generateAnswer({
          question: question.question ?? "",
          company: body.company ?? "",
          role: body.role ?? "",
          jdText: body.jdText,
          jobUrl: body.jobUrl,
        });

        return {
          id: question.id ?? `question_${index}`,
          question: question.question,
          ...answer,
        };
      }),
    );

    return jsonOk({ answers });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate answers",
      500,
    );
  }
}
