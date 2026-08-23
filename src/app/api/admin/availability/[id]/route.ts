import { z } from "zod";
import { db } from "@/db/client";
import { updateAvailability } from "@/domain/availability";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";

const command = z.object({
  expectedVersion: z.number().int().positive(),
  capacityMl: z.number().int().nonnegative(),
  manualSoldOut: z.boolean(),
  soldOutReason: z.string().max(500).optional(),
  acceptsOrders: z.boolean().optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability command", 422);
    const { id } = await params;
    const actor = await requirePermission(db(), request, parsed.data.manualSoldOut ? "availability.sold_out" : "availability.write");
    return success(await updateAvailability(db(), { id, ...parsed.data, actor: actor.email ?? actor.id }));
  } catch (error) {
    return failure(error);
  }
}
