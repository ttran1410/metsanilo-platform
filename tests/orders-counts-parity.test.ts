import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { orders, orderPayments, packages, products, shops } from "@/db/schema";
import { getAdminOrderQuickViewCounts } from "@/domain/admin-order-actions";
import { listManagerOrdersWithPaymentSummary } from "@/domain/orders";
import { getOrderTriageReasons } from "@/domain/order-triage";
import { resetEnvForTests } from "@/lib/env";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-orders-counts-test-"));
let database: Database;
let closeDatabase = () => {};

beforeEach(async () => {
  const url = `file:${join(directory, `case-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)}`;
  process.env.TURSO_DATABASE_URL = url;
  process.env.SHOP_ID = "shop-main";
  resetEnvForTests();
  const connection = createDatabaseConnection(url);
  database = connection.database;
  closeDatabase = connection.close;
  await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });
  await database.insert(shops).values({ id: "shop-main", slug: "main", nameFi: "Test", nameEn: "Test", timezone: "Europe/Helsinki", active: true, pickupNameFi: "Nouto", pickupNameEn: "Pickup", pickupAddress: "Address", pickupInstructionsFi: "Ohje", pickupInstructionsEn: "Instruction", pickupTime: "20:00" });
  await database.insert(products).values({ id: "product-1", shopId: "shop-main", code: "TEST", slug: "test", nameFi: "Test", nameEn: "Test", availableFrom: "2026-01-01", availableThrough: "2026-12-31" });
  await database.insert(packages).values({ id: "package-1", shopId: "shop-main", productId: "product-1", labelFi: "1L", labelEn: "1L", volumeMl: 1000, priceCents: 1000 });
});

afterEach(() => closeDatabase());
afterAll(() => rmSync(directory, { recursive: true, force: true }));

function order(id: string, values: Partial<typeof orders.$inferInsert> = {}): typeof orders.$inferInsert {
  const now = new Date(Date.now() - 30 * 60_000).toISOString();
  return { id, shopId: "shop-main", publicReference: id, idempotencyKey: `key-${id}`, productId: "product-1", packageId: "package-1", productNameFi: "Test", productNameEn: "Test", packageLabelFi: "1L", packageLabelEn: "1L", quantity: 1, volumeMl: 1000, itemSubtotalCents: 1000, finalTotalCents: 1000, fulfillmentDate: "2000-01-01", fulfillmentMethod: "DELIVERY", customerName: "Customer", mobile: "0400000000", locale: "fi", status: "NEW", createdAt: now, updatedAt: now, ...values };
}

describe("Orders quick-count parity", () => {
  it("matches baseline triage and unpaid behavior while excluding another shop", async () => {
    await database.insert(shops).values({ id: "shop-other", slug: "other", nameFi: "Other", nameEn: "Other", timezone: "Europe/Helsinki", active: true, pickupNameFi: "Nouto", pickupNameEn: "Pickup", pickupAddress: "Address", pickupInstructionsFi: "Ohje", pickupInstructionsEn: "Instruction", pickupTime: "20:00" });
    await database.insert(orders).values([
      order("overdue-new"),
      order("unpaid-today", { status: "READY", fulfillmentDate: new Date().toISOString().slice(0, 10), deliveryFeeCents: 0 }),
      order("paid-today", { status: "READY", fulfillmentDate: new Date().toISOString().slice(0, 10), fulfillmentMethod: "PICKUP", deliveryFeeCents: 0 }),
      order("other-shop", { shopId: "shop-other" }),
    ]);
    await database.insert(orderPayments).values({ id: "payment-1", shopId: "shop-main", orderId: "paid-today", amountCents: 1000, method: "CASH", recordedAt: new Date().toISOString(), actor: "admin" });
    const baseline = await listManagerOrdersWithPaymentSummary(database);
    const expectedTriage = baseline.filter((item) => getOrderTriageReasons(item).length > 0).length;
    const expectedUnpaid = baseline.filter((item) => !item.archived && item.paymentStatus === "UNPAID").length;
    const actual = await getAdminOrderQuickViewCounts(database, { actor: { id: "admin", shopId: "shop-main", role: "ADMIN" }, shop: { id: "shop-main" } });
    expect(actual.TRIAGE).toBe(expectedTriage);
    expect(actual.UNPAID).toBe(expectedUnpaid);
    expect(actual.ALL).toBe(3);
  });
});
