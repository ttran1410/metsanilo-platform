import { toNextJsHandler } from "better-auth/next-js";
import { getBetterAuthInstance } from "@/lib/better-auth";
import { resolveCorrelationId } from "@/lib/correlation-id";
import { methodNotAllowed } from "@/app/api/response";

export const runtime = "nodejs";

const ALLOWED_BETTER_AUTH_PATHS = [
  "/sign-in/email",
  "/get-session",
  "/sign-out",
];

function isAllowedBetterAuthRequest(request: Request): boolean {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "");
    return ALLOWED_BETTER_AUTH_PATHS.some((path) => pathname.endsWith(path));
  } catch {
    return false;
  }
}

export function withCorrelationHeader(response: Response, correlationId: string): Response {
  try {
    response.headers.set("x-correlation-id", correlationId);
    return response;
  } catch {
    const rawSetCookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""].filter(Boolean);
    const headers = new Headers(response.headers);
    headers.set("x-correlation-id", correlationId);
    if (rawSetCookies.length > 1) {
      headers.delete("set-cookie");
      for (const cookie of rawSetCookies) {
        headers.append("set-cookie", cookie);
      }
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

function endpointDisabledResponse(request: Request) {
  const correlationId = resolveCorrelationId(request);
  return new Response(
    request.method === "HEAD"
      ? null
      : JSON.stringify({
          code: "ENDPOINT_DISABLED",
          message: "Use canonical application authentication endpoints.",
          correlationId,
        }),
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
        "x-correlation-id": correlationId,
      },
    },
  );
}

function previewAuthDisabled(request: Request) {
  return process.env.VERCEL_ENV === "preview" && new URL(request.url).pathname.endsWith("/sign-in/email");
}

export async function GET(request: Request) {
  const correlationId = resolveCorrelationId(request);
  if (!isAllowedBetterAuthRequest(request)) return endpointDisabledResponse(request);
  const response = await toNextJsHandler(getBetterAuthInstance()).GET(request);
  return withCorrelationHeader(response, correlationId);
}

export async function POST(request: Request) {
  const correlationId = resolveCorrelationId(request);
  if (!isAllowedBetterAuthRequest(request)) return endpointDisabledResponse(request);
  if (previewAuthDisabled(request)) {
    return new Response(
      request.method === "HEAD"
        ? null
        : JSON.stringify({
            code: "PREVIEW_AUTH_DISABLED",
            message: "Admin authentication is unavailable on preview deployments.",
            correlationId,
          }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
          "x-correlation-id": correlationId,
        },
      },
    );
  }
  const response = await toNextJsHandler(getBetterAuthInstance()).POST(request);
  return withCorrelationHeader(response, correlationId);
}

export async function PUT(request: Request) {
  return methodNotAllowed(["GET", "POST"], request);
}

export async function PATCH(request: Request) {
  return methodNotAllowed(["GET", "POST"], request);
}

export async function DELETE(request: Request) {
  return methodNotAllowed(["GET", "POST"], request);
}

export async function OPTIONS(request: Request) {
  return methodNotAllowed(["GET", "POST"], request);
}

export async function HEAD(request: Request) {
  const correlationId = resolveCorrelationId(request);
  if (!isAllowedBetterAuthRequest(request)) return endpointDisabledResponse(request);
  const getRequest = new Request(request.url, {
    method: "GET",
    headers: request.headers,
  });
  const getResponse = await GET(getRequest);
  return new Response(null, {
    status: getResponse.status,
    statusText: getResponse.statusText,
    headers: getResponse.headers,
  });
}
