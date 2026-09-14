import { z } from "zod";
import { updateAdminAvailability } from "@/domain/admin-availability-actions";
import { executeAdminRoute, parseJson } from "../../module";
import { DomainError } from "@/domain/errors";

export const runtime = "nodejs";

const command = z.object({
  expectedVersion: z.number().int().positive(),
  capacityMl: z.number().int().nonnegative(),
  manualSoldOut: z.boolean(),
  soldOutReason: z.string().max(500).optional(),
  acceptsOrders: z.boolean().optional(),
  cutoffOverride: z.enum(["OPEN", "CLOSED"]).nullable().optional(),
  source: z.enum(["MANUAL_EDIT", "QUICK_ADJUST"]).optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permissions: ["availability.write", "availability.sold_out", "availability.cutoff.override"],
    parse: async (incoming) => {
      const parsed = command.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability command", 422);
      return parsed.data;
    },
    run: async (input, { database, context }) => {
      const { id } = await params;
      return updateAdminAvailability(database, { actor: context.actor, shop: { id: context.shop.shopId } }, id, input);
    },
  });
}

