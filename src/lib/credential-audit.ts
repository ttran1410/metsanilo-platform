import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries } from "@/db/schema";
import { env } from "./env";

/** Record an expiry observation once per temporary-credential issuance. */
export async function recordTemporaryCredentialExpired(
  database: Database,
  user: { id: string; shopId?: string | null; email?: string | null; temporaryPasswordExpiresAt?: string | null },
  now: Date = new Date(),
) {
  const existing = await database
    .select({ detailsJson: auditEntries.detailsJson })
    .from(auditEntries)
    .where(and(eq(auditEntries.shopId, user.shopId ?? env().SHOP_ID), eq(auditEntries.entityId, user.id), eq(auditEntries.action, "user.temporary_password_expired")))
    .all();
  const expiry = user.temporaryPasswordExpiresAt ?? null;
  if (existing.some((entry) => {
    try { return (JSON.parse(entry.detailsJson) as { expiresAt?: string | null }).expiresAt === expiry; } catch { return false; }
  })) return false;
  await database.insert(auditEntries).values({
    id: randomUUID(), shopId: env().SHOP_ID, actor: user.email ?? user.id,
    action: "user.temporary_password_expired", entityType: "user", entityId: user.id,
    detailsJson: JSON.stringify({ expiresAt: expiry, attemptedAt: now.toISOString() }), createdAt: now.toISOString(),
  });
  return true;
}
