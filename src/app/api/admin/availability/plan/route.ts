import { z } from "zod";
import { db } from "@/db/client";
import { authenticateAdmin, authenticateAdminAny, parseJson } from "../../module";
import { planAdminAvailability, previewAdminAvailabilityPlan } from "@/domain/admin-availability-actions";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { env } from "@/lib/env";

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
    await authenticateAdminAny(request, ["availability.write", "availability.sold_out"]);
    const parsed = command.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability plan", 422);
    const permission = parsed.data.manualSoldOut ? "availability.sold_out" : "availability.write";
    const context = await authenticateAdmin(request, permission);
    const actionContext = { actor: context.actor, shop: { id: env().SHOP_ID } };
    if (parsed.data.preview) return success(await previewAdminAvailabilityPlan(db(), actionContext, parsed.data));
    return success(await planAdminAvailability(db(), actionContext, parsed.data));
  } catch (error) {
    return failure(error);
  }
}
