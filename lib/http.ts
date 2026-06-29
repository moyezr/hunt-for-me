import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, { status });
}

export function jsonError(error: string, status = 500) {
  return NextResponse.json<ApiResponse<never>>(
    { ok: false, error },
    { status },
  );
}
