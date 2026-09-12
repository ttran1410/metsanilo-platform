import { toNextJsHandler } from "better-auth/next-js";
import { getBetterAuthInstance } from "@/lib/better-auth";

export const runtime = "nodejs";

function previewAuthDisabled(request: Request) {
  return process.env.VERCEL_ENV === "preview" && new URL(request.url).pathname.endsWith("/sign-in/email");
}

export async function GET(request: Request) {
  return toNextJsHandler(getBetterAuthInstance()).GET(request);
}

export async function POST(request: Request) {
  if (previewAuthDisabled(request)) return Response.json({ code: "PREVIEW_AUTH_DISABLED", message: "Admin authentication is unavailable on preview deployments." }, { status: 404 });
  return toNextJsHandler(getBetterAuthInstance()).POST(request);
}
