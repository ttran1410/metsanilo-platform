import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, customers, orders } from "@/db/schema";
import { DomainError } from "./errors";
import { anonymizeCustomer, clearCustomerRetentionHold, confirmCustomerContact, createCustomer, mergeCustomers, renewCustomerContact, setCustomerRetentionHold, updateCustomer } from "./customers";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

function actorName(context: AdminActionContext) { assertAdminActionContext(context); return context.actor.email ?? context.actor.id; }

export type AdminCustomerCreateInput = Parameters<typeof createCustomer>[1];
export async function createAdminCustomer(database: Database, context: AdminActionContext, input: AdminCustomerCreateInput) { actorName(context); return createCustomer(database, input); }
export type AdminCustomerUpdateInput = Parameters<typeof updateCustomer>[2];
export async function updateAdminCustomer(database: Database, context: AdminActionContext, id: string, input: AdminCustomerUpdateInput) { return updateCustomer(database, id, input, actorName(context)); }
export async function anonymizeAdminCustomer(database: Database, context: AdminActionContext, id: string) { return anonymizeCustomer(database, id, actorName(context)); }
export async function mergeAdminCustomers(database: Database, context: AdminActionContext, id: string, duplicateId: string) { return mergeCustomers(database, id, duplicateId, actorName(context)); }
export type AdminCustomerConfirmationInput = Omit<Parameters<typeof confirmCustomerContact>[3], never>;
export async function confirmAdminCustomerContact(database: Database, context: AdminActionContext, id: string, channel: Parameters<typeof confirmCustomerContact>[3], note?: string) { return confirmCustomerContact(database, id, actorName(context), channel, note); }
export async function renewAdminCustomerContact(database: Database, context: AdminActionContext, id: string) { return renewCustomerContact(database, id, actorName(context)); }
export async function setAdminCustomerRetentionHold(database: Database, context: AdminActionContext, id: string, until: string, reason: string) { return setCustomerRetentionHold(database, id, actorName(context), until, reason); }
export async function clearAdminCustomerRetentionHold(database: Database, context: AdminActionContext, id: string) { return clearCustomerRetentionHold(database, id, actorName(context)); }

export type AdminCustomerNotesAndConsentInput = {
  notes?: string | null;
  marketingConsent?: boolean;
};

export async function updateAdminCustomerNotesAndConsent(
  database: Database,
  context: AdminActionContext,
  id: string,
  input: AdminCustomerNotesAndConsentInput,
) {
  const actor = actorName(context);
  const now = new Date().toISOString();
  const values: Partial<typeof customers.$inferInsert> = {};
  if (input.notes !== undefined) values.notes = input.notes?.trim() || null;
  if (input.marketingConsent !== undefined) {
    values.marketingConsent = input.marketingConsent;
    values.marketingConsentStatus = input.marketingConsent ? "CONSENTED" : "REVOKED";
    values.marketingConsentAt = now;
    values.marketingConsentSource = "ADMIN";
    values.marketingConsentUpdatedBy = actor;
  }
  values.updatedAt = now;
  const [updated] = await database.update(customers)
    .set(values)
    .where(and(eq(customers.id, id), eq(customers.shopId, context.shop.id)))
    .returning();
  if (!updated) throw new DomainError("NOT_FOUND", "Customer not found", 404);

  const actions = [];
  if (input.notes !== undefined) actions.push({ action: "customer.notes_updated", details: { notes: input.notes?.trim() || null } });
  if (input.marketingConsent !== undefined) actions.push({ action: "customer.marketing_consent_updated", details: { marketingConsent: input.marketingConsent, marketingConsentStatus: values.marketingConsentStatus } });
  for (const entry of actions) {
    await database.insert(auditEntries).values({ id: randomUUID(), shopId: context.shop.id, actor, action: entry.action, entityType: "customer", entityId: id, detailsJson: JSON.stringify(entry.details), createdAt: now });
  }
  return updated;
}

export type AdminCustomerIdentityInput = { id: string; action: "KEEP_SEPARATE" | "MERGE"; duplicateId?: string; reason: string };
export async function resolveAdminCustomerIdentity(database: Database, context: AdminActionContext, input: AdminCustomerIdentityInput) {
  const actor = actorName(context); const current = await database.query.customers.findFirst({ where: and(eq(customers.id, input.id), eq(customers.shopId, context.shop.id)) });
  if (!current) throw new DomainError("NOT_FOUND", "Customer not found", 404);
  const now = new Date().toISOString();
  if (input.action === "KEEP_SEPARATE") {
    await database.update(customers).set({ matchStatus: "ACTIVE", notes: `Identity reviewed: kept separate. ${input.reason}`, updatedAt: now }).where(and(eq(customers.id, input.id), eq(customers.shopId, context.shop.id)));
  } else {
    if (!input.duplicateId || input.duplicateId === input.id) throw new DomainError("VALIDATION_ERROR", "Choose the duplicate customer to merge", 422);
    const duplicate = await database.query.customers.findFirst({ where: and(eq(customers.id, input.duplicateId), eq(customers.shopId, context.shop.id)) });
    if (!duplicate || duplicate.mobile !== current.mobile) throw new DomainError("CONFLICT_REVIEW", "The selected record is not a matching identity", 409);
    await database.transaction(async (tx) => { await tx.update(orders).set({ customerId: input.id }).where(and(eq(orders.customerId, duplicate.id), eq(orders.shopId, context.shop.id))); await tx.update(customers).set({ notes: `Merged into ${input.id}. ${input.reason}`, matchStatus: "ACTIVE", updatedAt: now }).where(and(eq(customers.id, input.id), eq(customers.shopId, context.shop.id))); await tx.delete(customers).where(and(eq(customers.id, duplicate.id), eq(customers.shopId, context.shop.id))); });
  }
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: context.shop.id, actor, action: input.action === "MERGE" ? "customer.identity_merged" : "customer.identity_kept_separate", entityType: "customer", entityId: input.id, detailsJson: JSON.stringify({ duplicateId: input.duplicateId ?? null, reason: input.reason }), createdAt: now });
  return { resolved: true, action: input.action };
}
