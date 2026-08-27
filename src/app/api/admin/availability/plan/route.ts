import { z } from "zod";
import { db } from "@/db/client";
import { authenticateAdmin, parseJson } from "../../module";
import { planAvailability, previewAvailabilityPlan } from "@/domain/availability";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";

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
    const parsed = command.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability plan", 422);
    const permission = parsed.data.manualSoldOut ? "availability.sold_out" : "availability.write";
    const context = await authenticateAdmin(request, permission);
    if (parsed.data.preview) return success(await previewAvailabilityPlan(db(), parsed.data));
    return success(await planAvailability(db(), { ...parsed.data, actor: context.actor.email ?? context.actor.id }));
  } catch (error) {
    return failure(error);
  }
}
