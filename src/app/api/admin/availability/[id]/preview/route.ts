import { z } from "zod";
import { previewAdminAvailability } from "@/domain/admin-availability-actions";
import { DomainError } from "@/domain/errors";
import { executeAdminRoute, parseJson } from "../../../module";

export const runtime = "nodejs";

const command = z.object({
  expectedVersion: z.number().int().positive(),
  capacityMl: z.number().int().nonnegative(),
  manualSoldOut: z.boolean(),
  acceptsOrders: z.boolean().optional(),
});

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "availability.write",
    parse: async (incoming) => {
      const parsed = command.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability preview payload", 422);
      return parsed.data;
    },
    run: async (input, { database, context }) => {
      const { id } = await routeContext.params;
      return previewAdminAvailability(database, { actor: context.actor, shop: { id: context.shop.shopId } }, id, input);
    },
  });
}

