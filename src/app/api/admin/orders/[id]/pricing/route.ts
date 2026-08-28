import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { auditEntries, orders } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { getManagerOrder } from "@/domain/orders";
import { env } from "@/lib/env";
import { failure, success } from "../../../../response";
import { authenticateAdmin, parseJson } from "../../../module";


export const dynamic = "force-dynamic";
export const revalidate = 0;


const command = z.object({ expectedVersion: z.number().int().positive(), itemSubtotalCents: z.number().int().nonnegative(), deliveryFeeCents: z.number().int().nonnegative().nullable().optional(), reason: z.string().trim().min(2).max(500) });
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = (await authenticateAdmin(request, "orders.update")).actor;
    const parsed = command.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid order pricing", 422);
    const { id } = await params;
    const current = await db().query.orders.findFirst({ where: and(eq(orders.id, id), eq(orders.shopId, env().SHOP_ID)) });
    if (!current) throw new DomainError("NOT_FOUND", "Order not found", 404);
    if (current.version !== parsed.data.expectedVersion) throw new DomainError("STALE_VERSION", "Order changed", 409);
    const fee = parsed.data.deliveryFeeCents === undefined ? current.deliveryFeeCents : parsed.data.deliveryFeeCents;
    if (current.fulfillmentMethod === "PICKUP" && fee !== 0) throw new DomainError("INVALID_ORDER", "Pickup orders cannot have a delivery fee", 409);
    const finalTotalCents = fee === null ? null : parsed.data.itemSubtotalCents + fee;
    const now = new Date().toISOString();
    const changed = await db().update(orders).set({ itemSubtotalCents: parsed.data.itemSubtotalCents, deliveryFeeCents: fee, finalTotalCents, version: sql`${orders.version} + 1`, updatedAt: now }).where(and(eq(orders.id, id), eq(orders.version, parsed.data.expectedVersion))).run();
    if (changed.rowsAffected !== 1) throw new DomainError("STALE_VERSION", "Order changed", 409);
    await db().insert(auditEntries).values({ id: randomUUID(), shopId: env().SHOP_ID, actor: actor.email ?? actor.id, action: "order.pricing_updated", entityType: "order", entityId: id, detailsJson: JSON.stringify({ fromItemSubtotalCents: current.itemSubtotalCents, toItemSubtotalCents: parsed.data.itemSubtotalCents, fromDeliveryFeeCents: current.deliveryFeeCents, toDeliveryFeeCents: fee, reason: parsed.data.reason }), createdAt: now });
    return success(await getManagerOrder(db(), id));
  } catch (error) { return failure(error); }
}
