import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabaseConnection, type Database } from "@/db/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { auditEntries, shops, users } from "@/db/schema";
import { resetEnvForTests } from "@/lib/env";
import {
  getAuditCategory,
  getAuditMetrics,
  getAuditSeverity,
  listAuditEntries,
  parseAuditDiff,
} from "@/domain/audit";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-audit-test-"));
let databaseUrl = "";
let database: Database;
let closeDatabase: () => void;

describe("Security & Audit Engine", () => {
  beforeEach(async () => {
    databaseUrl = `file:${join(directory, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)}`;
    process.env.TURSO_DATABASE_URL = databaseUrl;
    process.env.SHOP_ID = "shop-main";
    resetEnvForTests();
    const connection = createDatabaseConnection(databaseUrl);
    database = connection.database;
    closeDatabase = connection.close;
    await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });

    await database.insert(shops).values({
      id: "shop-main",
      slug: "main",
      nameFi: "Testikauppa",
      nameEn: "Test Shop",
      timezone: "Europe/Helsinki",
      active: true,
      pickupNameFi: "Nouto",
      pickupNameEn: "Pickup",
      pickupAddress: "Torikatu 1",
      pickupInstructionsFi: "Ohje",
      pickupInstructionsEn: "Instruction",
      pickupTime: "20:00",
    });

    await database.insert(users).values({
      id: "usr_admin",
      shopId: "shop-main",
      email: "admin@metsanilo.fi",
      passwordHash: "hash",
      displayName: "Juho Metsä",
      role: "ADMIN",
      active: true,
      createdAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    if (closeDatabase) closeDatabase();
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("classifies risk severity correctly", () => {
    expect(getAuditSeverity("user.grant_permission")).toBe("HIGH");
    expect(getAuditSeverity("customer.anonymize")).toBe("HIGH");
    expect(getAuditSeverity("orders.export")).toBe("HIGH");

    expect(getAuditSeverity("order.price_override")).toBe("MEDIUM");
    expect(getAuditSeverity("order.refund")).toBe("MEDIUM");

    expect(getAuditSeverity("order.transition")).toBe("STANDARD");
  });

  it("classifies audit category correctly", () => {
    expect(getAuditCategory("order")).toBe("ORDERS");
    expect(getAuditCategory("user")).toBe("USERS");
    expect(getAuditCategory("customer")).toBe("CUSTOMERS");
    expect(getAuditCategory("availability")).toBe("AVAILABILITY");
  });

  it("parses before and after state diffs from detailsJson", () => {
    const json = JSON.stringify({
      summary: "Manual price override applied",
      reason: "Discount agreed for 50L bulk order",
      before: { finalTotalCents: 4500 },
      after: { finalTotalCents: 3500 },
    });

    const diff = parseAuditDiff(json);
    expect(diff.summary).toBe("Manual price override applied");
    expect(diff.reason).toBe("Discount agreed for 50L bulk order");
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes?.[0]).toEqual({
      field: "finalTotalCents",
      oldVal: 4500,
      newVal: 3500,
    });
  });

  it("fetches filtered audit entries and calculates anomaly metrics", async () => {
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 1000).toISOString();
    await database.insert(auditEntries).values([
      {
        id: "aud_1",
        shopId: "shop-main",
        actor: "usr_admin",
        action: "user.grant_permission",
        entityType: "user",
        entityId: "usr_staff",
        detailsJson: JSON.stringify({ summary: "Granted orders.export" }),
        createdAt: now,
      },
      {
        id: "aud_2",
        shopId: "shop-main",
        actor: "usr_admin",
        action: "order.price_override",
        entityType: "order",
        entityId: "R-9102",
        detailsJson: JSON.stringify({ summary: "Price override" }),
        createdAt: earlier,
      },
    ]);

    const result = await listAuditEntries(database, { page: 1, limit: 10 });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.actorDisplayName).toBe("Juho Metsä");
    expect(result.items[0]?.severity).toBe("HIGH");

    const metrics = await getAuditMetrics(database);
    expect(metrics.highRisk).toBe(1);
    expect(metrics.sensitiveEdits).toBe(1);
  });
});
