import { z } from "zod";
import { setAdminDeliveryFee } from "@/domain/admin-order-actions";
import { env } from "@/lib/env";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ expectedVersion: z.number().int().positive(), deliveryFeeCents: z.number().int().nonnegative() });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await executeAdmin(request, { permission: "delivery.override", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid delivery fee", 422); return parsed.data; }, run: async (input, { database, context: { actor } }) => setAdminDeliveryFee(database, { actor, shop: { id: env().SHOP_ID } }, { orderId: (await params).id, ...input }) });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
