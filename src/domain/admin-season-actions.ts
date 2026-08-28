import type { Database } from "@/db/client";
import { cloneHarvestSeason, createHarvestSeason, deleteHarvestSeason, extendHarvestSeason, updateHarvestSeason } from "./seasons";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

export type AdminSeasonContext = AdminActionContext;
export type AdminSeasonCreateInput = Parameters<typeof createHarvestSeason>[1];
export type AdminSeasonUpdateInput = Parameters<typeof updateHarvestSeason>[2];

function actorName(context: AdminSeasonContext) {
  assertAdminActionContext(context);
  return context.actor.email ?? context.actor.id;
}

export function createAdminSeason(database: Database, context: AdminSeasonContext, input: AdminSeasonCreateInput) {
  return createHarvestSeason(database, input, actorName(context));
}

export function cloneAdminSeason(database: Database, context: AdminSeasonContext, sourceSeasonId: string, input: Parameters<typeof cloneHarvestSeason>[2], productId: string) {
  return cloneHarvestSeason(database, sourceSeasonId, input, actorName(context), productId);
}

export function updateAdminSeason(database: Database, context: AdminSeasonContext, seasonId: string, input: AdminSeasonUpdateInput) {
  return updateHarvestSeason(database, seasonId, input, actorName(context));
}

export function extendAdminSeason(database: Database, context: AdminSeasonContext, seasonId: string, days: number) {
  return extendHarvestSeason(database, seasonId, days, actorName(context));
}

export function deleteAdminSeason(database: Database, context: AdminSeasonContext, seasonId: string) {
  return deleteHarvestSeason(database, seasonId, actorName(context));
}
