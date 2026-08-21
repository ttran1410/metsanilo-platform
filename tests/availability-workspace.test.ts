import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { shops } from "@/db/schema";
import { getAvailabilityWorkspace, getDaysInMonth, getStartOfWeek } from "@/domain/availability";
import { resetEnvForTests } from "@/lib/env";
import { todayInTimezone } from "@/lib/format";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-availability-workspace-test-"));
let databaseUrl = "";
let database: Database;
let closeDatabase: () => void = () => {};
let testNumber = 0;

beforeEach(async () => {
  testNumber += 1;
  databaseUrl = `file:${join(directory, `test-${testNumber}.db`)}`;
  process.env.TURSO_DATABASE_URL = databaseUrl;
  process.env.SHOP_ID = "shop-main";
  process.env.SHOP_TIMEZONE = "Europe/Helsinki";
  resetEnvForTests();
  const connection = createDatabaseConnection(databaseUrl);
  database = connection.database;
  closeDatabase = connection.close;
  await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });
  await database.insert(shops).values({
    id: "shop-main",
    slug: "main",
    nameFi: "Testikauppa",
    nameEn: "Test shop",
    timezone: "Europe/Helsinki",
    active: true,
    pickupNameFi: "Nouto",
    pickupNameEn: "Pickup",
    pickupAddress: "Osoite",
    pickupInstructionsFi: "Ohje",
    pickupInstructionsEn: "Instruction",
    pickupTime: "20:00",
  });
});

afterEach(() => {
  closeDatabase();
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("getAvailabilityWorkspace date anchoring", () => {
  it("returns exactly the requested window when startDate is provided", async () => {
    const workspace = await getAvailabilityWorkspace(database, { startDate: "2099-08-17", days: 7 });
    expect(workspace.dates).toHaveLength(7);
    expect(workspace.startDate).toBe("2099-08-17");
    expect(workspace.endDate).toBe("2099-08-23");
    expect(workspace.dates[workspace.dates.length - 1]).toBe("2099-08-23");
    expect(workspace.today).toBe(todayInTimezone("Europe/Helsinki"));
  });

  it("defaults to shop-timezone today when no options are given", async () => {
    const workspace = await getAvailabilityWorkspace(database);
    expect(workspace.startDate).toBe(workspace.today);
    expect(workspace.dates[0]).toBe(workspace.today);
  });

  it("caps the requested day count at 60", async () => {
    const workspace = await getAvailabilityWorkspace(database, { startDate: "2099-08-17", days: 90 });
    expect(workspace.dates).toHaveLength(60);
  });

  it("returns an anchored empty payload when the shop is missing", async () => {
    process.env.SHOP_ID = "shop-other";
    resetEnvForTests();
    const workspace = await getAvailabilityWorkspace(database);
    expect(workspace.dates).toHaveLength(0);
    expect(workspace.startDate).toBe(workspace.today);
    expect(workspace.today).toBe(todayInTimezone("Europe/Helsinki"));
  });
});

describe("availability calendar helpers", () => {
  it("anchors weeks on Monday", () => {
    expect(getStartOfWeek("2026-08-21")).toBe("2026-08-17");
    expect(getStartOfWeek("2026-08-17")).toBe("2026-08-17");
    expect(getStartOfWeek("2026-08-23")).toBe("2026-08-17");
  });

  it("counts calendar days per month", () => {
    expect(getDaysInMonth("2026-08-01")).toBe(31);
    expect(getDaysInMonth("2026-02-01")).toBe(28);
    expect(getDaysInMonth("2028-02-01")).toBe(29);
  });
});
