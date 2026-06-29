import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export function GET() {
  try {
    getDb();

    return jsonOk({
      status: "healthy",
      service: "hunt-for-me",
      time: new Date().toISOString(),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Health check failed",
      500,
    );
  }
}
