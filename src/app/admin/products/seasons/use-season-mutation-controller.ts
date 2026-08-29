"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import type { AdminProductSeason as SeasonItem } from "../types/season";
import { createSeason, deleteSeason, extendSeason, updateSeasonGoal } from "./season-admin-actions";

function addDays(dateStr: string, days: number) { const date = new Date(`${dateStr}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }

export function useSeasonMutationController({ productId, availableFrom, availableThrough, cloneSourceId, nameEn, nameFi, startDate, endDate, notes, targetLitres, onUpdateDates, setSeasons, setShowAddForm, setCloneSourceId, setDeleteSeasonId }: {
  productId?: string; availableFrom: string; availableThrough: string; cloneSourceId: string | null; nameEn: string; nameFi: string; startDate: string; endDate: string; notes: string; targetLitres: string; onUpdateDates?: (from: string, through: string) => void; setSeasons: Dispatch<SetStateAction<SeasonItem[]>>; setShowAddForm: (open: boolean) => void; setCloneSourceId: (id: string | null) => void; setDeleteSeasonId: (id: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  function litres() { const value = targetLitres.trim() === "" ? null : Number(targetLitres); return value === null || (Number.isInteger(value) && value > 0) ? value : undefined; }
  async function saveSeasonGoal(season: SeasonItem) { if (!productId) return; const value = litres(); if (value === undefined) return; setBusy(true); try { const data = await updateSeasonGoal(productId, season.id, value === null ? null : value * 1000); if (data) setSeasons((current) => current.map((item) => item.id === season.id ? data : item)); } finally { setBusy(false); } }
  async function saveFallbackSeasonGoal() { if (!productId) return; const value = litres(); if (value === undefined) return; setBusy(true); try { const year = new Date(`${availableFrom}T00:00:00Z`).getUTCFullYear(); const data = await createSeason(productId, { nameEn: `${year} Harvest Season`, nameFi: `${year} Satokausi`, startDate: availableFrom, endDate: availableThrough, notes: "", targetVolumeMl: value === null ? null : value * 1000 }); if (data) setSeasons([data]); } finally { setBusy(false); } }
  async function handleAddSeason(event: FormEvent) { event.preventDefault(); if (!productId) return; setBusy(true); try { const data = await createSeason(productId, { nameFi, nameEn, startDate, endDate, notes, targetVolumeMl: targetLitres ? Number(targetLitres) * 1000 : null }, cloneSourceId); if (data) { setSeasons((current) => [data, ...current]); setShowAddForm(false); setCloneSourceId(null); if (onUpdateDates && data.status === "ACTIVE") onUpdateDates(data.startDate, data.endDate); } } finally { setBusy(false); } }
  function handleDeleteSeason(seasonId: string) { if (productId) setDeleteSeasonId(seasonId); }
  async function confirmDeleteSeason(deleteSeasonId: string | null) { if (!productId || !deleteSeasonId) return; setBusy(true); try { await deleteSeason(productId, deleteSeasonId); setSeasons((current) => current.filter((season) => season.id !== deleteSeasonId)); } finally { setBusy(false); setDeleteSeasonId(null); } }
  async function handleExtendSeason(season: SeasonItem) { if (!productId) { onUpdateDates?.(availableFrom, addDays(availableThrough, 7)); return; } setBusy(true); try { const data = await extendSeason(productId, season.id); if (data) { setSeasons((current) => current.map((item) => item.id === season.id ? data : item)); onUpdateDates?.(season.startDate, addDays(season.endDate, 7)); } } finally { setBusy(false); } }
  return { busy, saveSeasonGoal, saveFallbackSeasonGoal, handleAddSeason, handleDeleteSeason, confirmDeleteSeason, handleExtendSeason };
}
