import { toNextJsHandler } from "better-auth/next-js";
import { getBetterAuthInstance } from "@/lib/better-auth";

export const runtime = "nodejs";

const BLOCKED_BETTER_AUTH_PATHS = [
  "/change-password",
  "/set-password",
  "/reset-password",
  "/request-password-reset",
];

function isBlockedBetterAuthRequest(request: Request): boolean {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "");
    return BLOCKED_BETTER_AUTH_PATHS.some((path) => pathname.endsWith(path)) || /\/reset-password\/[^/]+$/.test(pathname);
  } catch {
    return false;
  }
}

function previewAuthDisabled(request: Request) {
  return process.env.VERCEL_ENV === "preview" && new URL(request.url).pathname.endsWith("/sign-in/email");
}

export async function GET(request: Request) {
  if (isBlockedBetterAuthRequest(request)) {
    return Response.json(
      { code: "ENDPOINT_DISABLED", message: "Use canonical application password management endpoints." },
      { status: 404 }
    );
  }
  return toNextJsHandler(getBetterAuthInstance()).GET(request);
}

export async function POST(request: Request) {
  if (isBlockedBetterAuthRequest(request)) {
    return Response.json(
      { code: "ENDPOINT_DISABLED", message: "Use canonical application password management endpoints." },
      { status: 404 }
    );
  }
  if (previewAuthDisabled(request)) {
    return Response.json(
      { code: "PREVIEW_AUTH_DISABLED", message: "Admin authentication is unavailable on preview deployments." },
      { status: 404 }
    );
  }
  return toNextJsHandler(getBetterAuthInstance()).POST(request);
}
