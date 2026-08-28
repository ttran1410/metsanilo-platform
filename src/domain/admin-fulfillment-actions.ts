import { randomUUID } from "node:crypto";
import { and, eq, like, or, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { fulfillmentLocations, orders } from "@/db/schema";
import { DomainError } from "./errors";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

export type AdminFulfillmentLocationInput = { type: "PICKUP" | "DELIVERY_ORIGIN"; nameFi: string; nameEn: string; address: string; instructionsFi: string; instructionsEn: string; active: boolean; isDefault: boolean };

function actorName(context: AdminActionContext) { assertAdminActionContext(context); return context.actor.email ?? context.actor.id; }

export async function createAdminFulfillmentLocation(database: Database, context: AdminActionContext, input: AdminFulfillmentLocationInput) {
  const actor = actorName(context); const now = new Date().toISOString(); const id = randomUUID();
  await database.transaction(async (tx) => { if (input.isDefault) await tx.update(fulfillmentLocations).set({ isDefault: false }).where(and(eq(fulfillmentLocations.shopId, context.shop.id), eq(fulfillmentLocations.type, input.type))); await tx.insert(fulfillmentLocations).values({ id, shopId: context.shop.id, ...input, createdAt: now, updatedAt: now }); });
  const row = await database.query.fulfillmentLocations.findFirst({ where: and(eq(fulfillmentLocations.id, id), eq(fulfillmentLocations.shopId, context.shop.id)) });
  if (!row) throw new DomainError("CREATE_FAILED", "Fulfillment location could not be created", 500);
  return { ...row, updatedBy: actor };
}

export type AdminFulfillmentLocationUpdate = { id: string; values: Partial<AdminFulfillmentLocationInput> };
export async function updateAdminFulfillmentLocation(database: Database, context: AdminActionContext, input: AdminFulfillmentLocationUpdate) {
  const actor = actorName(context); const current = await database.query.fulfillmentLocations.findFirst({ where: and(eq(fulfillmentLocations.id, input.id), eq(fulfillmentLocations.shopId, context.shop.id)) });
  if (!current) throw new DomainError("NOT_FOUND", "Fulfillment location not found", 404);
  await database.transaction(async (tx) => { if (input.values.isDefault) await tx.update(fulfillmentLocations).set({ isDefault: false }).where(and(eq(fulfillmentLocations.shopId, context.shop.id), eq(fulfillmentLocations.type, input.values.type ?? current.type))); await tx.update(fulfillmentLocations).set({ ...input.values, updatedAt: new Date().toISOString() }).where(and(eq(fulfillmentLocations.id, input.id), eq(fulfillmentLocations.shopId, context.shop.id))); });
  const row = await database.query.fulfillmentLocations.findFirst({ where: and(eq(fulfillmentLocations.id, input.id), eq(fulfillmentLocations.shopId, context.shop.id)) });
  return { ...row, updatedBy: actor };
}

export async function deleteAdminFulfillmentLocation(database: Database, context: AdminActionContext, id: string) {
  const actor = actorName(context); const current = await database.query.fulfillmentLocations.findFirst({ where: and(eq(fulfillmentLocations.id, id), eq(fulfillmentLocations.shopId, context.shop.id)) });
  if (!current) throw new DomainError("NOT_FOUND", "Fulfillment location not found", 404);
  if (current.isDefault) throw new DomainError("FORBIDDEN", "Cannot delete system default location. Set another location as default first.", 409);
  const [{ count }] = await database.select({ count: sql<number>`count(*)` }).from(orders).where(and(eq(orders.shopId, context.shop.id), or(eq(orders.pickupName, current.nameFi), eq(orders.pickupName, current.nameEn), like(orders.pickupLocationSnapshotJson, `%${id}%`))));
  if (Number(count) > 0) throw new DomainError("CONFLICT", `Cannot delete location: linked to ${count} historical orders. Deactivate it instead.`, 409);
  await database.delete(fulfillmentLocations).where(and(eq(fulfillmentLocations.id, id), eq(fulfillmentLocations.shopId, context.shop.id)));
  return { deleted: true, id, updatedBy: actor };
}
