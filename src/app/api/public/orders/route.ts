import { db } from "@/db/client";
import { submitOrder } from "@/domain/orders";
import { failure, success } from "../../response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16_384) return new Response("Payload too large", { status: 413 });
    return success(await submitOrder(db(), await request.json()), 201);
  } catch (error) {
    return failure(error);
  }
}
