import type { AdminProductSeason } from "../types/season";

export type SeasonInput = { nameFi: string; nameEn: string; startDate: string; endDate: string; notes: string; targetVolumeMl: number | null };

async function requestSeason(path: string, init: RequestInit) {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({})) as { data?: AdminProductSeason; message?: string };
  if (!response.ok) throw new Error(body.message ?? "Season action failed.");
  return body.data;
}

export function updateSeasonGoal(productId: string, seasonId: string, targetVolumeMl: number | null) { return requestSeason(`/api/admin/products/${productId}/seasons/${seasonId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetVolumeMl }) }); }
export function createSeason(productId: string, input: SeasonInput, sourceSeasonId?: string | null) { return requestSeason(`/api/admin/products/${productId}/seasons`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sourceSeasonId ? { action: "clone", sourceSeasonId, ...input } : input) }); }
export function deleteSeason(productId: string, seasonId: string) { return requestSeason(`/api/admin/products/${productId}/seasons/${seasonId}`, { method: "DELETE" }); }
export function extendSeason(productId: string, seasonId: string) { return requestSeason(`/api/admin/products/${productId}/seasons/${seasonId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "extend", additionalDays: 7 }) }); }
