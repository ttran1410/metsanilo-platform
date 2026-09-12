import { NextResponse } from "next/server";
import { DomainError } from "@/domain/errors";
import { resolveCorrelationId, CORRELATION_ID_HEADER } from "@/lib/correlation-id";

export function success(data: unknown, request: Request, status = 200) {
  const correlationId = resolveCorrelationId(request);
  return NextResponse.json(
    { data, correlationId },
    {
      status,
      headers: {
        [CORRELATION_ID_HEADER]: correlationId,
      },
    },
  );
}

export function failure(error: unknown, request: Request) {
  const correlationId = resolveCorrelationId(request);
  if (error instanceof DomainError) {
    return NextResponse.json(
      {
        code: error.code,
        message: error.message,
        detail: error.detail ?? (error.fieldErrors ? JSON.stringify(error.fieldErrors) : undefined),
        fieldErrors: error.fieldErrors,
        correlationId,
      },
      {
        status: error.status,
        headers: {
          [CORRELATION_ID_HEADER]: correlationId,
        },
      },
    );
  }
  const errorMessage = error instanceof Error ? error.message : String(error ?? "Unknown error");
  console.error("Request failed", { correlationId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
  return NextResponse.json(
    {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred while processing your request. Please try again or contact support.",
      correlationId,
    },
    {
      status: 500,
      headers: {
        [CORRELATION_ID_HEADER]: correlationId,
      },
    },
  );
}

export function methodNotAllowed(allowedMethods: string[], request: Request) {
  const correlationId = resolveCorrelationId(request);
  return new Response(
    request.method === "HEAD"
      ? null
      : JSON.stringify({
          code: "METHOD_NOT_ALLOWED",
          message: `Method not allowed. Supported method: ${allowedMethods.join(", ")}.`,
          correlationId,
        }),
    {
      status: 405,
      headers: {
        Allow: allowedMethods.join(", "),
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
        [CORRELATION_ID_HEADER]: correlationId,
      },
    },
  );
}
