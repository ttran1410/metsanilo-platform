import { z } from "zod";
import { assertAdminPermission, executeAdminRoute, parseJson } from "../../module";
import { planAdminAvailability, previewAdminAvailabilityPlan } from "@/domain/admin-availability-actions";
import { DomainError } from "@/domain/errors";

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
  return executeAdminRoute(request, {
    permissions: ["availability.write", "availability.sold_out"],
    parse: async (incoming) => {
      const parsed = command.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability plan", 422);
      return parsed.data;
    },
    authorize: async (input, { context }) => {
      await assertAdminPermission(context, input.manualSoldOut ? "availability.sold_out" : "availability.write");
    },
    run: async (input, { database, context }) => {
      const actionContext = { actor: context.actor, shop: { id: context.shop.shopId } };
      return input.preview
        ? previewAdminAvailabilityPlan(database, actionContext, input)
        : planAdminAvailability(database, actionContext, input);
    },
  });
}
