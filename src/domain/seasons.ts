import { randomUUID } from "node:crypto";
import { and, desc, eq, lte, gte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, harvestSeasons, products } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";

export type SeasonStatus = "UPCOMING" | "ACTIVE" | "PAUSED" | "COMPLETED";

export function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysToDateStr(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function listHarvestSeasons(database: Database, productId: string) {
  const { SHOP_ID } = env();
  return database
    .select()
    .from(harvestSeasons)
    .where(and(eq(harvestSeasons.shopId, SHOP_ID), eq(harvestSeasons.productId, productId)))
    .orderBy(desc(harvestSeasons.startDate));
}

export async function getActiveHarvestSeason(database: Database, productId: string) {
  const seasons = await listHarvestSeasons(database, productId);
  const today = todayDateStr();

  // Find explicit ACTIVE season or date-matched season
  const active = seasons.find((s) => s.status === "ACTIVE") ?? seasons.find((s) => s.startDate <= today && today <= s.endDate);
  return active ?? seasons[0] ?? null;
}

export async function createHarvestSeason(
  database: Database,
  input: {
    productId: string;
    nameFi: string;
    nameEn: string;
    startDate: string;
    endDate: string;
    status?: SeasonStatus;
    targetVolumeMl?: number | null;
    notes?: string | null;
  },
  actorEmail?: string
) {
  const { SHOP_ID } = env();

  if (input.startDate > input.endDate) {
    throw new DomainError("VALIDATION_ERROR", "Start date cannot be after end date", 422);
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  // Determine initial status based on dates if not specified
  const today = todayDateStr();
  let defaultStatus: SeasonStatus = "UPCOMING";
  if (input.startDate <= today && today <= input.endDate) {
    defaultStatus = "ACTIVE";
  } else if (today > input.endDate) {
    defaultStatus = "COMPLETED";
  }

  const newSeason = {
    id,
    shopId: SHOP_ID,
    productId: input.productId,
    nameFi: input.nameFi.trim(),
    nameEn: input.nameEn.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status ?? defaultStatus,
    targetVolumeMl: input.targetVolumeMl ?? null,
    notes: input.notes?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await database.insert(harvestSeasons).values(newSeason);

  // Sync products table legacy window to latest active season
  await syncProductLegacyWindow(database, input.productId);

  if (actorEmail) {
    await database.insert(auditEntries).values({
      id: randomUUID(),
      shopId: SHOP_ID,
      actor: actorEmail,
      action: "harvest_season.created",
      entityType: "harvest_season",
      entityId: id,
      detailsJson: JSON.stringify(newSeason),
      createdAt: now,
    });
  }

  return newSeason;
}

export async function updateHarvestSeason(
  database: Database,
  seasonId: string,
  input: {
    nameFi?: string;
    nameEn?: string;
    startDate?: string;
    endDate?: string;
    status?: SeasonStatus;
    targetVolumeMl?: number | null;
    notes?: string | null;
  },
  actorEmail?: string
) {
  const { SHOP_ID } = env();
  const existing = await database.query.harvestSeasons.findFirst({
    where: and(eq(harvestSeasons.id, seasonId), eq(harvestSeasons.shopId, SHOP_ID)),
  });

  if (!existing) throw new DomainError("NOT_FOUND", "Harvest season not found", 404);

  const startDate = input.startDate ?? existing.startDate;
  const endDate = input.endDate ?? existing.endDate;

  if (startDate > endDate) {
    throw new DomainError("VALIDATION_ERROR", "Start date cannot be after end date", 422);
  }

  const now = new Date().toISOString();
  const updatedValues = {
    nameFi: input.nameFi !== undefined ? input.nameFi.trim() : existing.nameFi,
    nameEn: input.nameEn !== undefined ? input.nameEn.trim() : existing.nameEn,
    startDate,
    endDate,
    status: input.status ?? existing.status,
    targetVolumeMl: input.targetVolumeMl !== undefined ? input.targetVolumeMl : existing.targetVolumeMl,
    notes: input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : existing.notes,
    updatedAt: now,
  };

  await database
    .update(harvestSeasons)
    .set(updatedValues)
    .where(and(eq(harvestSeasons.id, seasonId), eq(harvestSeasons.shopId, SHOP_ID)));

  await syncProductLegacyWindow(database, existing.productId);

  if (actorEmail) {
    await database.insert(auditEntries).values({
      id: randomUUID(),
      shopId: SHOP_ID,
      actor: actorEmail,
      action: "harvest_season.updated",
      entityType: "harvest_season",
      entityId: seasonId,
      detailsJson: JSON.stringify(updatedValues),
      createdAt: now,
    });
  }

  return (await database.query.harvestSeasons.findFirst({ where: eq(harvestSeasons.id, seasonId) }))!;
}

export async function extendHarvestSeason(
  database: Database,
  seasonId: string,
  days: number = 7,
  actorEmail?: string
) {
  const existing = await database.query.harvestSeasons.findFirst({
    where: eq(harvestSeasons.id, seasonId),
  });

  if (!existing) throw new DomainError("NOT_FOUND", "Harvest season not found", 404);

  const newEndDate = addDaysToDateStr(existing.endDate, days);
  return updateHarvestSeason(database, seasonId, { endDate: newEndDate }, actorEmail);
}

export async function deleteHarvestSeason(database: Database, seasonId: string, actorEmail?: string) {
  const { SHOP_ID } = env();
  const existing = await database.query.harvestSeasons.findFirst({
    where: and(eq(harvestSeasons.id, seasonId), eq(harvestSeasons.shopId, SHOP_ID)),
  });

  if (!existing) throw new DomainError("NOT_FOUND", "Harvest season not found", 404);

  await database.delete(harvestSeasons).where(and(eq(harvestSeasons.id, seasonId), eq(harvestSeasons.shopId, SHOP_ID)));
  await syncProductLegacyWindow(database, existing.productId);

  if (actorEmail) {
    await database.insert(auditEntries).values({
      id: randomUUID(),
      shopId: SHOP_ID,
      actor: actorEmail,
      action: "harvest_season.deleted",
      entityType: "harvest_season",
      entityId: seasonId,
      detailsJson: JSON.stringify({ seasonId, productId: existing.productId }),
      createdAt: new Date().toISOString(),
    });
  }

  return true;
}

export async function syncProductLegacyWindow(database: Database, productId: string) {
  const { SHOP_ID } = env();
  const activeSeason = await getActiveHarvestSeason(database, productId);
  if (!activeSeason) return;

  await database
    .update(products)
    .set({
      availableFrom: activeSeason.startDate,
      availableThrough: activeSeason.endDate,
    })
    .where(and(eq(products.id, productId), eq(products.shopId, SHOP_ID)));
}
