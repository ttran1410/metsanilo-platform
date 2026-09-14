import { z } from "zod";
import { confirmAdminOrderPickup } from "@/domain/admin-order-actions";
import { DomainError } from "@/domain/errors";
import { executeAdminRoute, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ expectedVersion: z.number().int().positive() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "orders.update",
    parse: async (incoming) => {
      const parsed = command.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid pickup confirmation", 422);
      return parsed.data;
    },
    run: async (input, { database, context: { actor, shop } }) =>
      confirmAdminOrderPickup(database, { actor, shop: { id: shop.shopId } }, { orderId: (await params).id, ...input }),
  });
}

