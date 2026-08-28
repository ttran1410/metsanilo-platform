import type { Database } from "@/db/client";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { deletePaymentMethod, listPaymentMethods, setPaymentMethod, type PaymentMethod } from "./payment-methods";

export async function listAdminPaymentMethods(database: Database, context: AdminActionContext) { assertAdminActionContext(context); return listPaymentMethods(database); }
export async function setAdminPaymentMethod(database: Database, context: AdminActionContext, method: PaymentMethod, enabled: boolean) { assertAdminActionContext(context); return setPaymentMethod(database, method, enabled, context.actor.email ?? context.actor.id); }
export async function deleteAdminPaymentMethod(database: Database, context: AdminActionContext, method: string) { assertAdminActionContext(context); return deletePaymentMethod(database, method, context.actor.email ?? context.actor.id); }
