import { z } from "zod";
import { updateAdminOrderPricing } from "@/domain/admin-order-actions";
import { DomainError } from "@/domain/errors";
import { executeAdminRoute, parseJson } from "../../../module";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const command = z.object({ expectedVersion: z.number().int().positive(), itemSubtotalCents: z.number().int().nonnegative(), deliveryFeeCents: z.number().int().nonnegative().nullable().optional(), reason: z.string().trim().min(2).max(500) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "orders.update",
    parse: async (incoming) => {
      const parsed = command.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid order pricing", 422);
      const { id } = await params;
      return { orderId: id, ...parsed.data };
    },
    run: async (input, { database, context: { actor, shop } }) =>
      updateAdminOrderPricing(database, { actor, shop: { id: shop.shopId } }, input),
  });
}

