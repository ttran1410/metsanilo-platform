import { z } from "zod";
import { previewAdminAvailability } from "@/domain/admin-availability-actions";
import { env } from "@/lib/env";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";

const command = z.object({
  expectedVersion: z.number().int().positive(),
  capacityMl: z.number().int().nonnegative(),
  manualSoldOut: z.boolean(),
  acceptsOrders: z.boolean().optional(),
});

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const result = await executeAdmin(request, {
      permission: "availability.write",
      parse: async (incoming) => {
        const parsed = command.safeParse(await parseJson<unknown>(incoming));
        if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability preview payload", 422);
        return parsed.data;
      },
      run: async (input, { database, context }) => {
        const { id } = await routeContext.params;
        return previewAdminAvailability(database, { actor: context.actor, shop: { id: env().SHOP_ID } }, id, input);
      },
    });
    return success(result);
  } catch (error) {
    return failure(error, request);
  }
}
