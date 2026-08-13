import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { DomainError } from "@/domain/errors";

export function success(data: unknown, status = 200) {
  return NextResponse.json({ data, correlationId: randomUUID() }, { status });
}

export function failure(error: unknown) {
  const correlationId = randomUUID();
  if (error instanceof DomainError) {
    return NextResponse.json(
      { code: error.code, message: error.message, fieldErrors: error.fieldErrors, correlationId },
      { status: error.status },
    );
  }
  console.error("Request failed", { correlationId, error: error instanceof Error ? error.message : "unknown" });
  return NextResponse.json({ code: "INTERNAL_ERROR", message: "Request failed", correlationId }, { status: 500 });
}
