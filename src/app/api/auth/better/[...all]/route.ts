import { toNextJsHandler } from "better-auth/next-js";
import { betterAuthInstance } from "@/lib/better-auth";

export const runtime = "nodejs";

const handlers = toNextJsHandler(betterAuthInstance);
const enabled = () => process.env.BETTER_AUTH_ENABLED === "true";

export async function GET(request: Request) {
  if (!enabled()) return new Response("Not found", { status: 404 });
  return handlers.GET(request);
}

export async function POST(request: Request) {
  if (!enabled()) return new Response("Not found", { status: 404 });
  return handlers.POST(request);
}
