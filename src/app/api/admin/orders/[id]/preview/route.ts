import { z } from "zod";
import { previewAdminOrderUpdate } from "@/domain/admin-order-actions";
import { env } from "@/lib/env";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";

const command = z.object({
  expectedVersion: z.number().int().positive(),
  productId: z.string().optional(),
  packageId: z.string().optional(),
  quantity: z.number().int().min(1).max(100).optional(),
  fulfillmentDate: z.string().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const result = await executeAdmin(request, { permission: "orders.update", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid order preview payload", 422); return parsed.data; }, run: async (input, { database, context: { actor } }) => previewAdminOrderUpdate(database, { actor, shop: { id: env().SHOP_ID } }, { orderId: (await context.params).id, ...input }) });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
