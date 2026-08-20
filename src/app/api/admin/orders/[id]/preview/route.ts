import { z } from "zod";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { previewManagerOrderUpdate } from "@/domain/orders";
import { failure, success } from "../../../../response";

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
    await requirePermission(db(), request, "orders.update");
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) return failure({ message: "Invalid order preview payload", code: "VALIDATION_ERROR", status: 422 });
    const { id } = await context.params;
    return success(await previewManagerOrderUpdate(db(), { orderId: id, ...parsed.data }));
  } catch (error) {
    return failure(error);
  }
}
