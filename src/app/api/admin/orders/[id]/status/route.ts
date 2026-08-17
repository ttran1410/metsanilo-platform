import { z } from "zod";
import { db } from "@/db/client";
import { fromZodError } from "@/domain/errors";
import { transitionOrder } from "@/domain/orders";
import { failure, success } from "../../../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";

const command = z.object({
  status: z.enum(["CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "CUSTOMER_DECLINED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "REFUNDED"]),
  expectedVersion: z.number().int().positive(),
  reason: z.string().max(500).optional(),
  contactChannel: z.enum(["PHONE", "SMS", "EMAIL", "OTHER"]).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw fromZodError(parsed.error, "Invalid status command");
    const { id } = await params;
    await requirePermission(db(), request, "orders.transition");
    return success(await transitionOrder(db(), { orderId: id, ...parsed.data }));
  } catch (error) {
    return failure(error);
  }
}
