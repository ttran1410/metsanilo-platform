import { NextResponse } from "next/server";
import { methodNotAllowed } from "../../response";
import { resolveCorrelationId, CORRELATION_ID_HEADER } from "@/lib/correlation-id";

export const runtime = "nodejs";

function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestOrigin = new URL(request.url).origin;
    return originUrl.origin.toLowerCase() === requestOrigin.toLowerCase();
  } catch {
    return false;
  }
}

function retiredResponse(request: Request) {
  const correlationId = resolveCorrelationId(request);
  const response = new NextResponse(
    request.method === "HEAD"
      ? null
      : JSON.stringify({
          code: "ENDPOINT_RETIRED",
          message: "Legacy logout endpoint is decommissioned. Use Better Auth.",
          correlationId,
        }),
    {
      status: 410,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
        [CORRELATION_ID_HEADER]: correlationId,
      },
    },
  );
  response.cookies.delete("metsanilo_session");
  response.cookies.delete("better-auth.session_token");
  response.cookies.delete("__Secure-better-auth.session_token");
  return response;
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    const correlationId = resolveCorrelationId(request);
    return new NextResponse(
      JSON.stringify({
        code: "FORBIDDEN",
        message: "Same-origin request required",
        correlationId,
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
          [CORRELATION_ID_HEADER]: correlationId,
        },
      },
    );
  }
  return retiredResponse(request);
}

export async function GET(request: Request) {
  return methodNotAllowed(["POST", "OPTIONS", "HEAD"], request);
}

export async function PUT(request: Request) {
  return methodNotAllowed(["POST", "OPTIONS", "HEAD"], request);
}

export async function PATCH(request: Request) {
  return methodNotAllowed(["POST", "OPTIONS", "HEAD"], request);
}

export async function DELETE(request: Request) {
  return methodNotAllowed(["POST", "OPTIONS", "HEAD"], request);
}

export async function OPTIONS(request: Request) {
  const correlationId = resolveCorrelationId(request);
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS, HEAD",
      "Cache-Control": "no-store, max-age=0",
      [CORRELATION_ID_HEADER]: correlationId,
    },
  });
}

export async function HEAD(request: Request) {
  return retiredResponse(request);
}
