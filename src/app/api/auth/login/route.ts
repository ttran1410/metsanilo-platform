import { NextResponse } from "next/server";
import { methodNotAllowed } from "../../response";
import { resolveCorrelationId, CORRELATION_ID_HEADER } from "@/lib/correlation-id";
import { recordLegacyAuthUsage } from "@/lib/auth-telemetry";

export const runtime = "nodejs";

function retiredResponse(request: Request) {
  const correlationId = resolveCorrelationId(request);
  recordLegacyAuthUsage(request, "login_endpoint", 410, correlationId);
  const response = new NextResponse(
    request.method === "HEAD"
      ? null
      : JSON.stringify({
          code: "ENDPOINT_RETIRED",
          message: "Legacy login endpoint is decommissioned. Use Better Auth.",
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
