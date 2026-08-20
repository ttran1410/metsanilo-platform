import { z } from "zod";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { previewAvailabilityUpdate } from "@/domain/availability";
import { failure, success } from "../../../../response";

export const runtime = "nodejs";

const command = z.object({
  expectedVersion: z.number().int().positive(),
  capacityMl: z.number().int().nonnegative(),
  manualSoldOut: z.boolean(),
  acceptsOrders: z.boolean().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(db(), request, "availability.write");
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) return failure({ message: "Invalid availability preview payload", code: "VALIDATION_ERROR", status: 422 });
    const { id } = await context.params;
    return success(await previewAvailabilityUpdate(db(), { id, ...parsed.data }));
  } catch (error) {
    return failure(error);
  }
}
