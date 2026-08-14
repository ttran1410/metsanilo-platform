import { toNextJsHandler } from "better-auth/next-js";
import { betterAuthInstance } from "@/lib/better-auth";

export const runtime = "nodejs";

const handlers = toNextJsHandler(betterAuthInstance);

export async function GET(request: Request) {
  return handlers.GET(request);
}

export async function POST(request: Request) {
  return handlers.POST(request);
}
