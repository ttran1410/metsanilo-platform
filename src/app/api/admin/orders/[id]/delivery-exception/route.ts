import { z } from "zod";
import { db } from "@/db/client";
import { addDeliveryException } from "@/domain/orders";
import { requirePermission } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";

export const runtime = "nodejs";
const command = z.object({ type: z.enum(["CUSTOMER_UNAVAILABLE", "ADDRESS_ISSUE", "DELIVERY_DELAYED", "DELIVERY_FAILED", "RESCHEDULED"]), nextAction: z.string().min(1).max(120), note: z.string().max(1000).optional(), rescheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid delivery exception", 422);
    await requirePermission(db(), request, "orders.transition");
    return success(await addDeliveryException(db(), { orderId: (await params).id, ...parsed.data }));
  } catch (error) { return failure(error); }
}
