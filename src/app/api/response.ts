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
  const errorMessage = error instanceof Error ? error.message : String(error ?? "Unknown error");
  console.error("Request failed", { correlationId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
  return NextResponse.json(
    {
      code: "INTERNAL_ERROR",
      message: errorMessage || "Request failed",
      detail: error instanceof Error ? error.stack : errorMessage,
      correlationId,
    },
    { status: 500 },
  );
}
