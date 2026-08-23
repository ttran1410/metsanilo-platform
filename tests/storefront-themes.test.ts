import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { auditEntries, shops } from "@/db/schema";
import {
  getStorefrontThemeState,
  publishStorefrontThemeDraft,
  resolveStorefrontTheme,
  rollbackStorefrontTheme,
  saveStorefrontThemeDraft,
} from "@/domain/storefront-themes";
import { resetEnvForTests } from "@/lib/env";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-storefront-theme-test-"));
let database: Database;
let closeDatabase: () => void;

beforeEach(async () => {
  const databaseUrl = `file:${join(directory, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)}`;
  process.env.TURSO_DATABASE_URL = databaseUrl;
  process.env.SHOP_ID = "shop-theme";
  resetEnvForTests();
  const connection = createDatabaseConnection(databaseUrl);
  database = connection.database;
  closeDatabase = connection.close;
  await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });
  await database.insert(shops).values({
    id: "shop-theme",
    slug: "theme",
    nameFi: "Metsänilo",
    nameEn: "Metsanilo",
    timezone: "Europe/Helsinki",
    pickupNameFi: "Nouto",
    pickupNameEn: "Pickup",
    pickupAddress: "Torikatu 1",
    pickupInstructionsFi: "Ohje",
    pickupInstructionsEn: "Instructions",
    pickupTime: "20:00",
  });
});

afterEach(() => closeDatabase?.());
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("controlled storefront theme lifecycle", () => {
  it("keeps a saved draft separate from the published shop theme", async () => {
    const draft = await saveStorefrontThemeDraft(database, "nordic-ink", "admin@example.fi");
    const state = await getStorefrontThemeState(database);
    const shop = await database.query.shops.findFirst();

    expect(draft.version).toBe(1);
    expect(state.publishedTheme).toBe("forest-harvest");
    expect(state.draft?.themeKey).toBe("nordic-ink");
    expect(shop?.storefrontTheme).toBe("forest-harvest");
  });

  it("publishes the exact draft and records an audited version", async () => {
    const draft = await saveStorefrontThemeDraft(database, "berry-season", "manager@example.fi");
    await publishStorefrontThemeDraft(database, draft.id, "manager@example.fi");

    const state = await getStorefrontThemeState(database);
    const events = await database.select().from(auditEntries);
    expect(state.publishedTheme).toBe("berry-season");
    expect(state.draft).toBeNull();
    expect(state.versions[0]).toMatchObject({ version: 1, themeKey: "berry-season", status: "PUBLISHED" });
    expect(events.some((event) => event.action === "theme.published")).toBe(true);
  });

  it("rolls back by publishing a new version and preserves history", async () => {
    const first = await saveStorefrontThemeDraft(database, "nordic-ink", "admin@example.fi");
    await publishStorefrontThemeDraft(database, first.id, "admin@example.fi");
    const second = await saveStorefrontThemeDraft(database, "berry-season", "admin@example.fi");
    await publishStorefrontThemeDraft(database, second.id, "admin@example.fi");
    await rollbackStorefrontTheme(database, first.id, "admin@example.fi");

    const state = await getStorefrontThemeState(database);
    expect(state.publishedTheme).toBe("nordic-ink");
    expect(state.versions[0]).toMatchObject({ version: 3, themeKey: "nordic-ink", status: "PUBLISHED" });
    expect(state.versions.map((version) => version.version)).toEqual([3, 2, 1]);
    const events = await database.select().from(auditEntries);
    expect(events.some((event) => event.action === "theme.rolled_back")).toBe(true);
  });

  it("falls back safely when a persisted or preview key is unknown", () => {
    expect(resolveStorefrontTheme("unknown-theme")).toBe("forest-harvest");
    expect(resolveStorefrontTheme("nordic-ink")).toBe("nordic-ink");
  });
});
