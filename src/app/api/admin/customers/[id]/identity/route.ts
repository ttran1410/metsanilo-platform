import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEntries, customers, orders } from "@/db/schema";
import { requirePermission } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../../../response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(db(), request, "customers.identity.resolve");
    const { id } = await context.params;
    const body = await request.json() as { action?: "KEEP_SEPARATE" | "MERGE"; duplicateId?: string; reason?: string };
    const reason = body.reason?.trim();
    if (!body.action || !reason) throw new DomainError("VALIDATION_ERROR", "A resolution and reason are required", 422);
    const current = await db().query.customers.findFirst({ where: and(eq(customers.id, id), eq(customers.shopId, env().SHOP_ID)) });
    if (!current) throw new DomainError("NOT_FOUND", "Customer not found", 404);
    const now = new Date().toISOString();
    if (body.action === "KEEP_SEPARATE") {
      await db().update(customers).set({ matchStatus: "ACTIVE", notes: `Identity reviewed: kept separate. ${reason}`, updatedAt: now }).where(and(eq(customers.id, id), eq(customers.shopId, env().SHOP_ID)));
    } else {
      if (!body.duplicateId || body.duplicateId === id) throw new DomainError("VALIDATION_ERROR", "Choose the duplicate customer to merge", 422);
      const duplicate = await db().query.customers.findFirst({ where: and(eq(customers.id, body.duplicateId), eq(customers.shopId, env().SHOP_ID)) });
      if (!duplicate || duplicate.mobile !== current.mobile) throw new DomainError("CONFLICT_REVIEW", "The selected record is not a matching identity", 409);
      await db().transaction(async (tx) => {
        await tx.update(orders).set({ customerId: id }).where(and(eq(orders.customerId, duplicate.id), eq(orders.shopId, env().SHOP_ID)));
        await tx.update(customers).set({ notes: `Merged into ${id}. ${reason}`, matchStatus: "ACTIVE", updatedAt: now }).where(and(eq(customers.id, id), eq(customers.shopId, env().SHOP_ID)));
        await tx.delete(customers).where(and(eq(customers.id, duplicate.id), eq(customers.shopId, env().SHOP_ID)));
      });
    }
    await db().insert(auditEntries).values({ id: randomUUID(), shopId: env().SHOP_ID, actor: actor.email ?? actor.username ?? actor.id, action: body.action === "MERGE" ? "customer.identity_merged" : "customer.identity_kept_separate", entityType: "customer", entityId: id, detailsJson: JSON.stringify({ duplicateId: body.duplicateId ?? null, reason }), createdAt: now });
    return success({ resolved: true, action: body.action });
  } catch (error) { return failure(error); }
}
