import { z } from "zod";
import { recordAdminOrderRefund } from "@/domain/admin-order-actions";
import { DomainError } from "@/domain/errors";
import { executeAdminRoute, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ amountCents: z.number().int().positive(), method: z.enum(["CASH", "BANK_TRANSFER", "MOBILEPAY", "CARD", "OTHER"]), reason: z.string().min(2).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "orders.payment.write",
    status: 201,
    parse: async (incoming) => {
      const parsed = command.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid refund", 422);
      return parsed.data;
    },
    run: async (input, { database, context: { actor, shop } }) =>
      recordAdminOrderRefund(database, { actor, shop: { id: shop.shopId } }, { orderId: (await params).id, ...input }),
  });
}

