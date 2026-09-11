import { toNextJsHandler } from "better-auth/next-js";
import { getBetterAuthInstance } from "@/lib/better-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return toNextJsHandler(getBetterAuthInstance()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getBetterAuthInstance()).POST(request);
}
