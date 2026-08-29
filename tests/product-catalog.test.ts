import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { availability, harvestSeasons, shops } from "@/db/schema";
import { createProduct, getProductReadiness, listManagerProducts, reorderProducts, setProductActive } from "@/domain/products";
import { searchManagerProducts } from "@/domain/admin-search";
import { getPublicCatalog } from "@/domain/availability";
import { resetEnvForTests } from "@/lib/env";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-product-catalog-test-"));
let databaseUrl = "";
let database: Database;
let closeDatabase: () => void;
let testNumber = 0;

function dateOffset(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

beforeEach(async () => {
  testNumber += 1;
  databaseUrl = `file:${join(directory, `test-${testNumber}.db`)}`;
  process.env.TURSO_DATABASE_URL = databaseUrl;
  process.env.SHOP_ID = "shop-default";
  process.env.ADMIN_AUTH_TOKEN = "secret-token";
  resetEnvForTests();

  const conn = createDatabaseConnection(databaseUrl);
  database = conn.database;
  closeDatabase = conn.close;

  await migrate(database, { migrationsFolder: "./drizzle" });

  await database.insert(shops).values({
    id: "shop-default",
    slug: "main",
    nameFi: "Metsänilö Test",
    nameEn: "Metsanilo Test",
    timezone: "Europe/Helsinki",
    pickupAddress: "Torikatu 1",
    pickupInstructionsFi: "Nouto torilta",
    pickupInstructionsEn: "Pickup at market",
    pickupNameFi: "Pori Tori",
    pickupNameEn: "Pori Market",
    pickupTime: "10:00 - 14:00",
  });
});

afterAll(() => {
  if (closeDatabase) closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("Product Catalog Reordering & Archiving", () => {
  it("filters products by status and search with pagination metadata", async () => {
    const create = (code: string, name: string, from: string, through: string, active = true) => createProduct(database, {
      code, slug: code.toLowerCase(), nameFi: name, nameEn: name, descriptionFi: "", descriptionEn: "", availableFrom: from, availableThrough: through,
      active, showOnHomepage: true, showOnReserve: true, packages: [{ labelFi: "Box", labelEn: "Box", volumeMl: 1000, priceCents: 1000, active: true }],
    });
    await create("INSEASON", "In season", dateOffset(-1), dateOffset(1));
    await create("UPCOMING", "Upcoming", dateOffset(2), dateOffset(4));
    await create("ARCHIVED", "Archived", dateOffset(-4), dateOffset(-2));

    const query = { q: "", page: 1, pageSize: 10, offset: 0 };
    const inSeason = await searchManagerProducts(database, query, { status: "in_season" });
    const upcoming = await searchManagerProducts(database, query, { status: "upcoming" });
    const archived = await searchManagerProducts(database, query, { status: "archived" });
    const search = await searchManagerProducts(database, { ...query, q: "Upcoming" });
    expect(inSeason.items).toHaveLength(1);
    expect(upcoming.items).toHaveLength(1);
    expect(archived.items).toHaveLength(1);
    expect(search.items[0]?.product.code).toBe("UPCOMING");
    expect(upcoming.totalPages).toBe(1);
  });

  it("creates products, reorders them, and reflects reorder on manager & public catalog", async () => {
    const p1 = await createProduct(database, {
      code: "STRAWBERRY",
      slug: "strawberry",
      nameFi: "Mansikka",
      nameEn: "Strawberry",
      descriptionFi: "Tuore",
      descriptionEn: "Fresh",
      availableFrom: "2099-06-01",
      availableThrough: "2099-08-31",
      active: true,
      showOnHomepage: true,
      showOnReserve: true,
      packages: [{ labelFi: "5L Laatikko", labelEn: "5L Box", volumeMl: 5000, priceCents: 4000, active: true }],
    });

    const p2 = await createProduct(database, {
      code: "RASPBERRY",
      slug: "raspberry",
      nameFi: "Vadelma",
      nameEn: "Raspberry",
      descriptionFi: "Makea",
      descriptionEn: "Sweet",
      availableFrom: "2099-06-01",
      availableThrough: "2099-08-31",
      active: true,
      showOnHomepage: true,
      showOnReserve: true,
      packages: [{ labelFi: "3L Laatikko", labelEn: "3L Box", volumeMl: 3000, priceCents: 3500, active: true }],
    });

    // Reorder: Raspberry first, Strawberry second
    await reorderProducts(database, [p2.product.id, p1.product.id]);

    const managerList = await listManagerProducts(database);
    expect(managerList[0].product.id).toBe(p2.product.id);
    expect(managerList[1].product.id).toBe(p1.product.id);

    const publicCatalog = await getPublicCatalog(database);
    expect(publicCatalog).not.toBeNull();
    const publicProducts = publicCatalog!.rows.map((r) => r.product.id);
    expect(publicProducts[0]).toBe(p2.product.id);
  });

  it("archives and un-archives products correctly", async () => {
    const p = await createProduct(database, {
      code: "BLUEBERRY",
      slug: "blueberry",
      nameFi: "Mustikka",
      nameEn: "Blueberry",
      descriptionFi: "Metsä",
      descriptionEn: "Wild",
      availableFrom: "2099-06-01",
      availableThrough: "2099-08-31",
      active: true,
      showOnHomepage: true,
      showOnReserve: true,
      packages: [{ labelFi: "5L Laatikko", labelEn: "5L Box", volumeMl: 5000, priceCents: 4500, active: true }],
    });

    // Archive
    const archived = await setProductActive(database, p.product.id, false);
    expect(archived.product.active).toBe(false);

    // Un-archive
    const unarchived = await setProductActive(database, p.product.id, true);
    expect(unarchived.product.active).toBe(true);
  });

  it("creates upcoming product Puolukka and verifies getPublicCatalog returns seasonal dates", async () => {
    const puolukka = await createProduct(database, {
      code: "PUOLUKKA",
      slug: "puolukka",
      nameFi: "Puolukka",
      nameEn: "Lingonberry",
      descriptionFi: "Tuoretta puolukkaa",
      descriptionEn: "Fresh lingonberries",
      availableFrom: "2099-08-24",
      availableThrough: "2099-10-16",
      active: true,
      showOnHomepage: true,
      showOnReserve: true,
      packages: [{ labelFi: "10L Sanko", labelEn: "10L Bucket", volumeMl: 10000, priceCents: 5000, active: true }],
    });

    const publicCatalog = await getPublicCatalog(database);
    expect(publicCatalog).not.toBeNull();
    const item = publicCatalog!.rows.find((r) => r.product.id === puolukka.product.id);
    expect(item).toBeDefined();
    expect(item!.product.availableFrom).toBe("2099-08-24");
    expect(item!.product.availableThrough).toBe("2099-10-16");
  });

  it("reports product readiness blockers and becomes ready with season capacity", async () => {
    const product = await createProduct(database, {
      code: "READINESS",
      slug: "readiness",
      nameFi: "Valmius",
      nameEn: "Readiness",
      descriptionFi: "",
      descriptionEn: "",
      availableFrom: "2099-06-01",
      availableThrough: "2099-08-31",
      active: true,
      packages: [{ labelFi: "5L", labelEn: "5L", volumeMl: 5000, priceCents: 4000, active: true }],
    });

    const before = await getProductReadiness(database, product.product.id);
    expect(before.ready).toBe(false);
    expect(before.blockers).toContain("harvestSeason");
    expect(before.pricing.seasonAware).toBe(false);

    const seasonId = "readiness-season";
    await database.insert(harvestSeasons).values({ id: seasonId, shopId: "shop-default", productId: product.product.id, nameFi: "Kesä", nameEn: "Summer", startDate: "2099-06-01", endDate: "2099-08-31", status: "UPCOMING", targetVolumeMl: 10000, notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await database.insert(availability).values({ id: "readiness-availability", shopId: "shop-default", productId: product.product.id, seasonId, businessDate: "2099-06-01", capacityMl: 10000, reservedMl: 0, acceptsOrders: true, manualSoldOut: false, version: 1, updatedAt: new Date().toISOString() });

    const after = await getProductReadiness(database, product.product.id);
    expect(after.ready).toBe(true);
    expect(after.blockers).toEqual([]);
  });
});
