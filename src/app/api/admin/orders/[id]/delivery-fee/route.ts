import { z } from "zod";
import { db } from "@/db/client";
import { setDeliveryFee } from "@/domain/orders";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";
const command = z.object({ expectedVersion: z.number().int().positive(), deliveryFeeCents: z.number().int().nonnegative() });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid delivery fee", 422);
    const { id } = await params;
    await requirePermission(db(), request, "delivery.override");
    return success(await setDeliveryFee(db(), { orderId: id, ...parsed.data }));
  } catch (error) {
    return failure(error);
  }
}
