import { z } from "zod";
import { setAdminDeliveryFee } from "@/domain/admin-order-actions";
import { DomainError } from "@/domain/errors";
import { executeAdminRoute, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ expectedVersion: z.number().int().positive(), deliveryFeeCents: z.number().int().nonnegative() });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "delivery.override",
    parse: async (incoming) => {
      const parsed = command.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid delivery fee", 422);
      return parsed.data;
    },
    run: async (input, { database, context: { actor, shop } }) =>
      setAdminDeliveryFee(database, { actor, shop: { id: shop.shopId } }, { orderId: (await params).id, ...input }),
  });
}

