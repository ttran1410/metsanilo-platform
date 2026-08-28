import type { Database } from "@/db/client";
import { findAvailabilityDuplicateGroups, getAvailabilityWorkspace, planAvailability, previewAvailabilityPlan, previewAvailabilityUpdate, updateAvailability } from "./availability";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

export type AdminAvailabilityContext = AdminActionContext;
export type AdminAvailabilityPlanInput = Parameters<typeof planAvailability>[1];
export type AdminAvailabilityUpdateInput = Omit<Parameters<typeof updateAvailability>[1], "actor" | "id">;
export type AdminAvailabilityPreviewInput = Omit<Parameters<typeof previewAvailabilityUpdate>[1], "id">;
export type AdminAvailabilityWorkspaceQuery = Parameters<typeof getAvailabilityWorkspace>[1];

export function getAdminAvailabilityWorkspace(database: Database, context: AdminAvailabilityContext, query: AdminAvailabilityWorkspaceQuery) {
  assertAdminActionContext(context);
  return getAvailabilityWorkspace(database, query);
}

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

export function updateAdminAvailability(database: Database, context: AdminAvailabilityContext, id: string, input: AdminAvailabilityUpdateInput) {
  return updateAvailability(database, { id, ...input, actor: actorName(context) });
}

export function previewAdminAvailability(database: Database, context: AdminAvailabilityContext, id: string, input: AdminAvailabilityPreviewInput) {
  assertAdminActionContext(context);
  return previewAvailabilityUpdate(database, { id, ...input });
}

export function findAdminAvailabilityDuplicates(database: Database, context: AdminAvailabilityContext) {
  assertAdminActionContext(context);
  return findAvailabilityDuplicateGroups(database);
}
