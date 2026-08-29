import { z } from "zod";
import { executeAdmin, authenticateAdminAny, parseJson } from "../../module";
import { planAdminAvailability, previewAdminAvailabilityPlan } from "@/domain/admin-availability-actions";
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
    await authenticateAdminAny(request, ["availability.write", "availability.sold_out"]);
    const parsed = command.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability plan", 422);
    const permission = parsed.data.manualSoldOut ? "availability.sold_out" : "availability.write";
    const result = await executeAdmin(request, { permission, parse: async () => parsed.data, run: async (input, { database, context }) => { const actionContext = { actor: context.actor, shop: { id: context.shop.shopId } }; return input.preview ? previewAdminAvailabilityPlan(database, actionContext, input) : planAdminAvailability(database, actionContext, input); } });
    return success(result);
  } catch (error) {
    return failure(error, request);
  }
}
