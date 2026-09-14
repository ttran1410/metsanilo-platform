import { deleteAdminOrder, getAdminOrderDetail, getAdminOrderEditData, transitionAdminOrder, updateAdminOrder } from "@/domain/admin-order-actions";
import { fromZodError } from "@/domain/errors";
import { z } from "zod";
import { executeAdminRoute, parseJson } from "../../module";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "orders.read",
    parse: async () => (await params).id,
    run: async (orderId, { database, context: { actor, shop } }) =>
      new URL(request.url).searchParams.get("view") === "edit"
        ? getAdminOrderEditData(database, { actor, shop: { id: shop.shopId } }, orderId)
        : getAdminOrderDetail(database, { actor, shop: { id: shop.shopId } }, orderId),
  });
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
  mobile: z.string().trim().min(7).max(40).nullable().optional(),
  email: z.string().nullable().optional(),
  streetAddress: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  deliveryFeeCents: z.number().int().nonnegative().nullable().optional(),
  agreedItemSubtotalCents: z.number().int().nonnegative().optional(),
  adjustmentReason: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permissions: ["orders.transition", "orders.update"],
    parse: async (incoming) => parseJson<Record<string, unknown>>(incoming),
    run: async (body, { database, context: { actor, shop } }) => {
      const { id } = await params;
      if (body && typeof body === "object" && body.action === "transition") {
        const parsedTransition = transitionActionSchema.safeParse(body);
        if (!parsedTransition.success) {
          throw fromZodError(parsedTransition.error, "Unable to transition order status. Please check input parameters.");
        }
        const version = parsedTransition.data.expectedVersion ?? (await getAdminOrderDetail(database, { actor, shop: { id: shop.shopId } }, id)).order.version;
        return transitionAdminOrder(database, { actor, shop: { id: shop.shopId } }, { orderId: id, status: parsedTransition.data.status, expectedVersion: version, reason: parsedTransition.data.reason, contactChannel: parsedTransition.data.contactChannel });
      }

      const parsed = updateSchema.safeParse({ ...body, orderId: id });
      if (!parsed.success) {
        throw fromZodError(parsed.error, "Unable to update order details. Please check input fields.");
      }
      return updateAdminOrder(database, { actor, shop: { id: shop.shopId } }, { ...parsed.data, orderId: id });
    },
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "orders.delete",
    parse: async () => (await params).id,
    run: async (orderId, { database, context: { actor, shop } }) => deleteAdminOrder(database, { actor, shop: { id: shop.shopId } }, orderId),
  });
}

