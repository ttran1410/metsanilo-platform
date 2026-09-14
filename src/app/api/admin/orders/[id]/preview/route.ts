import { z } from "zod";
import { previewAdminOrderUpdate } from "@/domain/admin-order-actions";
import { DomainError } from "@/domain/errors";
import { executeAdminRoute, parseJson } from "../../../module";

export const runtime = "nodejs";

const command = z.object({
  expectedVersion: z.number().int().positive(),
  productId: z.string().optional(),
  packageId: z.string().optional(),
  quantity: z.number().int().min(1).max(100).optional(),
  fulfillmentDate: z.string().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "orders.update",
    parse: async (incoming) => {
      const parsed = command.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid order preview payload", 422);
      return parsed.data;
    },
    run: async (input, { database, context: { actor, shop } }) =>
      previewAdminOrderUpdate(database, { actor, shop: { id: shop.shopId } }, { orderId: (await context.params).id, ...input }),
  });
}

