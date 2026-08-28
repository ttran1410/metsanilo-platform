import type { Database } from "@/db/client";
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
