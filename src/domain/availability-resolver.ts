import { and, eq, gte, isNull, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { availability, harvestSeasons } from "@/db/schema";
import { DomainError } from "./errors";

type AvailabilityDatabase = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function resolveSeasonForAvailability(
  database: AvailabilityDatabase,
  input: { shopId: string; productId: string; businessDate: string; seasonId?: string | null },
) {
  const seasons = await database
    .select()
    .from(harvestSeasons)
    .where(and(eq(harvestSeasons.shopId, input.shopId), eq(harvestSeasons.productId, input.productId), lte(harvestSeasons.startDate, input.businessDate), gte(harvestSeasons.endDate, input.businessDate)));
  if (seasons.length > 1) throw new DomainError("SEASON_MISMATCH", "More than one harvest season matches the selected date", 409);
  const season = seasons[0] ?? null;
  if (input.seasonId && (!season || season.id !== input.seasonId)) {
    throw new DomainError("SEASON_MISMATCH", "The selected season does not match the availability date", 409);
  }
  return season;
}

export async function resolveAvailabilityForDate(
  database: AvailabilityDatabase,
  input: { shopId: string; productId: string; businessDate: string; seasonId?: string | null },
) {
  const exactWhere = and(eq(availability.shopId, input.shopId), eq(availability.productId, input.productId), input.seasonId ? eq(availability.seasonId, input.seasonId) : isNull(availability.seasonId), eq(availability.businessDate, input.businessDate));
  const exact = await database.query.availability.findFirst({ where: exactWhere });
  if (exact) return { row: exact, source: input.seasonId ? ("SEASON" as const) : ("LEGACY" as const) };

  if (input.seasonId) {
    const legacy = await database.query.availability.findMany({ where: and(eq(availability.shopId, input.shopId), eq(availability.productId, input.productId), isNull(availability.seasonId), eq(availability.businessDate, input.businessDate)) });
    if (legacy.length > 1) throw new DomainError("AMBIGUOUS_AVAILABILITY", "Multiple legacy availability rows exist for the selected date", 409);
    if (legacy[0]) return { row: legacy[0], source: "LEGACY" as const };
  }
  return null;
}
