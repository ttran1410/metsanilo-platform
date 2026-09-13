import { NextResponse } from "next/server";
import { resolveCorrelationId, CORRELATION_ID_HEADER } from "@/lib/correlation-id";

export const runtime = "nodejs";

function notFound(request: Request) {
  const correlationId = resolveCorrelationId(request);
  return NextResponse.json(
    { code: "NOT_FOUND", message: "Authentication endpoint not found", correlationId },
    { status: 404, headers: { [CORRELATION_ID_HEADER]: correlationId, "cache-control": "no-store" } },
  );
}

export function POST(request: Request) { return notFound(request); }
export function GET(request: Request) { return notFound(request); }
