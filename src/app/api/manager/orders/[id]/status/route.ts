import { z } from "zod";
import { db } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { transitionOrder } from "@/domain/orders";
import { failure, success } from "../../../../response";

export const runtime = "nodejs";

const command = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED"]),
  expectedVersion: z.number().int().positive(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid status command", 422);
    const { id } = await params;
    return success(await transitionOrder(db(), { orderId: id, ...parsed.data }));
  } catch (error) {
    return failure(error);
  }
}
