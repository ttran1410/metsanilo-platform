import type { Database } from "@/db/client";
import { planAvailability, previewAvailabilityPlan } from "./availability";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

export type AdminAvailabilityContext = AdminActionContext;
export type AdminAvailabilityPlanInput = Parameters<typeof planAvailability>[1];

function actorName(context: AdminAvailabilityContext) {
  assertAdminActionContext(context);
  return context.actor.email ?? context.actor.id;
}

export function previewAdminAvailabilityPlan(database: Database, context: AdminAvailabilityContext, input: AdminAvailabilityPlanInput) {
  assertAdminActionContext(context);
  return previewAvailabilityPlan(database, input);
}

export function planAdminAvailability(database: Database, context: AdminAvailabilityContext, input: AdminAvailabilityPlanInput) {
  return planAvailability(database, { ...input, actor: actorName(context) });
}
