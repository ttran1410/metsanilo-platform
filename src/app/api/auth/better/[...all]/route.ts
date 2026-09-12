import { toNextJsHandler } from "better-auth/next-js";
import { getBetterAuthInstance } from "@/lib/better-auth";

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

function endpointDisabledResponse() {
  return Response.json(
    { code: "ENDPOINT_DISABLED", message: "Use canonical application authentication endpoints." },
    { status: 404 },
  );
}

function previewAuthDisabled(request: Request) {
  return process.env.VERCEL_ENV === "preview" && new URL(request.url).pathname.endsWith("/sign-in/email");
}

export async function GET(request: Request) {
  if (!isAllowedBetterAuthRequest(request)) return endpointDisabledResponse();
  return toNextJsHandler(getBetterAuthInstance()).GET(request);
}

export async function POST(request: Request) {
  if (!isAllowedBetterAuthRequest(request)) return endpointDisabledResponse();
  if (previewAuthDisabled(request)) {
    return Response.json(
      { code: "PREVIEW_AUTH_DISABLED", message: "Admin authentication is unavailable on preview deployments." },
      { status: 404 }
    );
  }
  return toNextJsHandler(getBetterAuthInstance()).POST(request);
}
