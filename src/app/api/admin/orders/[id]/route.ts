import { db } from "@/db/client";
import { getManagerOrder, updateManagerOrder, deleteManagerOrder, transitionOrder } from "@/domain/orders";
import { failure, success } from "../../../response";
import { requirePermission } from "@/domain/access";
import { adminContext } from "@/app/admin/portal-auth";
import { DomainError, fromZodError } from "@/domain/errors";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requirePermission(db(), _request, "orders.read");
    return success(await getManagerOrder(db(), id));
  } catch (error) {
    return failure(error);
  }
}

const transitionActionSchema = z.object({
  action: z.literal("transition"),
  status: z.enum([
    "CONFIRMED",
    "PICKING",
    "READY",
    "OUT_FOR_DELIVERY",
    "PICKED_UP",
    "DELIVERED",
    "CUSTOMER_DECLINED",
    "CANCELLED",
    "CANCELLED_BY_CUSTOMER",
    "REJECTED",
    "NO_SHOW",
    "REFUNDED",
  ]),
  expectedVersion: z.number().int().optional(),
  reason: z.string().max(500).optional(),
  contactChannel: z.enum(["PHONE", "SMS", "EMAIL", "OTHER"]).optional(),
});

const updateSchema = z.object({
  expectedVersion: z.number().int(),
  productId: z.string().optional(),
  packageId: z.string().optional(),
  quantity: z.number().int().min(1).max(100).optional(),
  fulfillmentDate: z.string().optional(),
  fulfillmentMethod: z.enum(["PICKUP", "DELIVERY"]).optional(),
  orderSource: z.string().optional(),
  facebookProfile: z.string().nullable().optional(),
  customerName: z.string().trim().min(2).max(120).optional(),
  mobile: z.string().trim().min(7).max(40).optional(),
  email: z.string().nullable().optional(),
  streetAddress: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  deliveryFeeCents: z.number().int().nonnegative().nullable().optional(),
  agreedItemSubtotalCents: z.number().int().nonnegative().optional(),
  adjustmentReason: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body && typeof body === "object" && body.action === "transition") {
      const parsedTransition = transitionActionSchema.safeParse(body);
      if (!parsedTransition.success) {
        throw fromZodError(parsedTransition.error, "Invalid order transition payload");
      }
      await requirePermission(db(), request, "orders.transition");

      let version = parsedTransition.data.expectedVersion;
      if (version === undefined) {
        const orderData = await getManagerOrder(db(), id);
        version = orderData.order.version;
      }

      return success(
        await transitionOrder(db(), {
          orderId: id,
          status: parsedTransition.data.status,
          expectedVersion: version,
          reason: parsedTransition.data.reason,
          contactChannel: parsedTransition.data.contactChannel,
        })
      );
    }

    await requirePermission(db(), request, "orders.update");
    const parsed = updateSchema.safeParse({ ...body, orderId: id });
    if (!parsed.success) {
      throw fromZodError(parsed.error, "Invalid order update payload");
    }
    return success(await updateManagerOrder(db(), { ...parsed.data, orderId: id }));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { actor } = await adminContext();
    await requirePermission(db(), request, "orders.delete");
    return success(await deleteManagerOrder(db(), id, actor.email ?? undefined));
  } catch (error) {
    return failure(error);
  }
}
