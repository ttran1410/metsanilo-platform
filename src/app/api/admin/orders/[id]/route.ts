import { db } from "@/db/client";
import { getManagerOrder } from "@/domain/orders";
import { failure, success } from "../../../response";
import { requirePermission } from "@/domain/access";
import { updateManagerOrder } from "@/domain/orders";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requirePermission(db(), _request, "orders.read");
    return success(await getManagerOrder(db(), id));
  } catch (error) {
    return failure(error);
  }
}

const updateSchema = z.object({
  expectedVersion: z.number().int(), productId: z.string().optional(), packageId: z.string().optional(), quantity: z.number().int().min(1).max(100).optional(),
  fulfillmentDate: z.string().optional(), fulfillmentMethod: z.enum(["PICKUP", "DELIVERY"]).optional(), customerName: z.string().trim().min(2).max(120).optional(), mobile: z.string().trim().min(7).max(40).optional(), email: z.string().nullable().optional(), streetAddress: z.string().nullable().optional(), postalCode: z.string().nullable().optional(), city: z.string().nullable().optional(), deliveryFeeCents: z.number().int().nonnegative().nullable().optional(), agreedItemSubtotalCents: z.number().int().nonnegative().optional(), adjustmentReason: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requirePermission(db(), request, "orders.update");
    const parsed = updateSchema.safeParse({ ...(await request.json()), orderId: id });
    if (!parsed.success) return failure(new Error("Invalid order update"));
    return success(await updateManagerOrder(db(), { ...parsed.data, orderId: id }));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requirePermission(db(), request, "orders.update");
    const { deleteManagerOrder } = await import("@/domain/orders");
    return success(await deleteManagerOrder(db(), id));
  } catch (error) {
    return failure(error);
  }
}

