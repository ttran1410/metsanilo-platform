import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/db/client";
import { availability, products, harvestSeasons, shops } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createHarvestSeason,
  deleteHarvestSeason,
  extendHarvestSeason,
  getActiveHarvestSeason,
  listHarvestSeasons,
  updateHarvestSeason,
  cloneHarvestSeason,
} from "@/domain/seasons";
import { getAvailabilityWorkspace } from "@/domain/availability";
import { env } from "@/lib/env";

describe("Multi-Harvest Seasons Domain Logic", () => {
  const testSuffix = Date.now();
  const testProductId = `test-product-blueberry-${testSuffix}`;

  beforeEach(async () => {
    const { SHOP_ID } = env();
    const database = db();
    await migrate(database, { migrationsFolder: "./drizzle" });

    await database.insert(shops).values({
      id: SHOP_ID,
      slug: "metsanilo",
      nameFi: "Metsänilo",
      nameEn: "Metsänilo",
      timezone: "Europe/Helsinki",
      active: true,
      pickupNameFi: "Varasto",
      pickupNameEn: "Warehouse",
      pickupAddress: "Helsinki",
      pickupInstructionsFi: "Tule perälle",
      pickupInstructionsEn: "Come to back",
      pickupTime: "20:00",
      contactPhone: "0401234567",
      contactEmail: "info@metsanilo.fi",
      contactHours: "09-17",
    }).onConflictDoNothing();

    // Clean only this fixture. Other tables may legitimately reference products.
    await database.delete(harvestSeasons).where(eq(harvestSeasons.productId, testProductId));
    await database.delete(availability).where(eq(availability.productId, testProductId));
    await database.delete(products).where(eq(products.id, testProductId));

    await database.insert(products).values({
      id: testProductId,
      shopId: SHOP_ID,
      code: `MUSTIKKA-${testSuffix}`,
      slug: `mustikka-${testSuffix}`,
      nameFi: "Metsämustikka",
      nameEn: "Wild Blueberry",
      availableFrom: "2026-07-01",
      availableThrough: "2026-08-31",
      active: true,
    });
  });

  it("creates a new harvest season and lists seasons for product", async () => {
    const season = await createHarvestSeason(
      db(),
      {
        productId: testProductId,
        nameFi: "Kesä 2026 Satokausi",
        nameEn: "Summer 2026 Harvest",
        startDate: "2026-07-01",
        endDate: "2026-08-31",
        notes: "Excellent berry yield expected",
      },
      "admin@metsanilo.fi"
    );

    expect(season.id).toBeDefined();
    expect(season.nameEn).toBe("Summer 2026 Harvest");
    expect(season.startDate).toBe("2026-07-01");

    const allSeasons = await listHarvestSeasons(db(), testProductId);
    expect(allSeasons.length).toBe(1);
    expect(allSeasons[0].nameFi).toBe("Kesä 2026 Satokausi");
  });

  it("extends a harvest season by +7 days", async () => {
    const season = await createHarvestSeason(db(), {
      productId: testProductId,
      nameFi: "Kesä 2026",
      nameEn: "Summer 2026",
      startDate: "2026-07-01",
      endDate: "2026-08-31",
    });

    const extended = await extendHarvestSeason(db(), season.id, 7, "admin@metsanilo.fi");
    expect(extended.endDate).toBe("2026-09-07");

    const activeSeason = await getActiveHarvestSeason(db(), testProductId);
    expect(activeSeason?.endDate).toBe("2026-09-07");
  });

  it("updates and deletes a harvest season", async () => {
    const season = await createHarvestSeason(db(), {
      productId: testProductId,
      nameFi: "Syksy 2026",
      nameEn: "Autumn 2026",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });

    const updated = await updateHarvestSeason(db(), season.id, { nameEn: "Autumn 2026 Extended" });
    expect(updated.nameEn).toBe("Autumn 2026 Extended");

    await deleteHarvestSeason(db(), season.id, "admin@metsanilo.fi");
    const remaining = await listHarvestSeasons(db(), testProductId);
    expect(remaining.length).toBe(0);
  });

  it("clones a season and keeps availability reads isolated by season", async () => {
    const summer = await createHarvestSeason(db(), {
      productId: testProductId,
      nameFi: "Kesä 2026",
      nameEn: "Summer 2026",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
    const autumn = await cloneHarvestSeason(db(), summer.id, {
      nameFi: "Syksy 2026",
      nameEn: "Autumn 2026",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });

    expect(autumn.productId).toBe(testProductId);
    expect(autumn.startDate).toBe("2026-09-01");

    const { SHOP_ID } = env();
    await db().insert(availability).values([
      { id: `availability-summer-${testSuffix}`, shopId: SHOP_ID, productId: testProductId, seasonId: summer.id, businessDate: "2026-07-10", capacityMl: 10000, reservedMl: 2000, updatedAt: new Date().toISOString() },
      { id: `availability-autumn-${testSuffix}`, shopId: SHOP_ID, productId: testProductId, seasonId: autumn.id, businessDate: "2026-09-10", capacityMl: 20000, reservedMl: 5000, updatedAt: new Date().toISOString() },
    ]);

    const workspace = await getAvailabilityWorkspace(db(), { startDate: "2026-07-01", days: 60, seasonId: summer.id });
    expect(workspace.rows).toHaveLength(1);
    expect(workspace.rows[0].availability.seasonId).toBe(summer.id);
  });
});
