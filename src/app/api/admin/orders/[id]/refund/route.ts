import { z } from "zod";
import { recordAdminOrderRefund } from "@/domain/admin-order-actions";
import { env } from "@/lib/env";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ amountCents: z.number().int().positive(), method: z.enum(["CASH", "BANK_TRANSFER", "MOBILEPAY", "CARD", "OTHER"]), reason: z.string().min(2).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await executeAdmin(request, {
      permission: "orders.payment.write",
      parse: async (incoming) => {
        const parsed = command.safeParse(await parseJson<unknown>(incoming));
        if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid refund", 422);
        return parsed.data;
      },
      run: async (input, { database, context: { actor } }) => recordAdminOrderRefund(database, { actor, shop: { id: env().SHOP_ID } }, { orderId: (await params).id, ...input }),
    });
    return success(result, 201);
  } catch (error) { return failure(error, request); }
}
