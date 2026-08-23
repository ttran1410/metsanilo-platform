import { z } from "zod";
import { db } from "@/db/client";
import { planAvailability, previewAvailabilityPlan } from "@/domain/availability";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";

const command = z.object({
  productId: z.string().min(1),
  seasonId: z.string().min(1).optional(),
  frequency: z.enum(["DAY", "WEEK", "MONTH", "CUSTOM"]),
  startDate: z.string(),
  endDate: z.string(),
  dates: z.array(z.string()).optional(),
  capacityMl: z.number().int().nonnegative(),
  manualSoldOut: z.boolean().default(false),
  soldOutReason: z.string().max(500).optional(),
  preview: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability plan", 422);
    const actor = await requirePermission(db(), request, parsed.data.manualSoldOut ? "availability.sold_out" : "availability.write");
    if (parsed.data.preview) return success(await previewAvailabilityPlan(db(), parsed.data));
    return success(await planAvailability(db(), { ...parsed.data, actor: actor.email ?? actor.id }));
  } catch (error) {
    return failure(error);
  }
}
