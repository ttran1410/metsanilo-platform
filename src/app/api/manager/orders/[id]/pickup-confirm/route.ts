import { z } from "zod";
import { db } from "@/db/client";
import { confirmPickup } from "@/domain/orders";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";
const command = z.object({ expectedVersion: z.number().int().positive() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid pickup confirmation", 422);
    const { id } = await params;
    await requirePermission(db(), request, "orders.update");
    return success(await confirmPickup(db(), { orderId: id, ...parsed.data }));
  } catch (error) {
    return failure(error);
  }
}
