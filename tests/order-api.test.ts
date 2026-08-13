import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { createDatabaseConnection, type Database } from "@/db/client";
import { availability, orders, packages, products, shops } from "@/db/schema";
import { submitOrder, transitionOrder } from "@/domain/orders";
import { resetEnvForTests } from "@/lib/env";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-test-"));
let databaseUrl = "";
let database: Database;
let closeDatabase: () => void;
let testNumber = 0;

const pickupInput = (key: string, date = "2099-08-13") => ({
  locale: "fi" as const,
  productId: "product-berries",
  packageId: "package-5l",
  quantity: 1 as const,
  fulfillmentDate: date,
  fulfillmentMethod: "PICKUP" as const,
  customerName: "Test Customer",
  mobile: "+358401234567",
  email: "test@example.com",
  notes: "",
  privacyAcknowledged: true as const,
  idempotencyKey: key.padEnd(16, "x"),
});

beforeEach(async () => {
  testNumber += 1;
  databaseUrl = `file:${join(directory, `test-${testNumber}.db`)}`;
  process.env.TURSO_DATABASE_URL = databaseUrl;
  process.env.SHOP_ID = "shop-main";
  resetEnvForTests();
  const connection = createDatabaseConnection(databaseUrl);
  database = connection.database;
  closeDatabase = connection.close;
  await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });
  await database.insert(shops).values([
    {
      id: "shop-main", slug: "main", nameFi: "Testikauppa", nameEn: "Test shop",
      timezone: "Europe/Helsinki", active: true, pickupNameFi: "Nouto", pickupNameEn: "Pickup",
      pickupAddress: "Configured address", pickupInstructionsFi: "Ohje", pickupInstructionsEn: "Instruction",
      pickupTime: "20:00",
    },
    {
      id: "shop-other", slug: "other", nameFi: "Muu", nameEn: "Other",
      timezone: "Europe/Helsinki", active: true, pickupNameFi: "Muu", pickupNameEn: "Other",
      pickupAddress: "Other address", pickupInstructionsFi: "Muu", pickupInstructionsEn: "Other",
      pickupTime: "20:00",
    },
  ]);
  await database.insert(products).values({
    id: "product-berries", shopId: "shop-main", code: "BERRIES", slug: "berries",
    nameFi: "Marjat", nameEn: "Berries", availableFrom: "2099-01-01", availableThrough: "2099-12-31", active: true,
  });
  await database.insert(packages).values({
    id: "package-5l", shopId: "shop-main", productId: "product-berries",
    labelFi: "5 litraa", labelEn: "5 litres", volumeMl: 5000, priceCents: 2500, active: true,
  });
  await database.insert(availability).values([
    {
      id: "availability-main", shopId: "shop-main", productId: "product-berries", businessDate: "2099-08-13",
      capacityMl: 5000, reservedMl: 0, acceptsOrders: true, manualSoldOut: false, version: 1, updatedAt: new Date().toISOString(),
    },
    {
      id: "availability-next", shopId: "shop-main", productId: "product-berries", businessDate: "2099-08-14",
      capacityMl: 10000, reservedMl: 0, acceptsOrders: true, manualSoldOut: false, version: 1, updatedAt: new Date().toISOString(),
    },
  ]);
});

afterEach(() => closeDatabase());
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("public order transaction and API", () => {
  it("reserves capacity once for an idempotent replay", async () => {
    const first = await submitOrder(database, pickupInput("same-request"));
    const replay = await submitOrder(database, pickupInput("same-request"));
    expect(replay.publicReference).toBe(first.publicReference);
    const row = await database.query.availability.findFirst({ where: eq(availability.id, "availability-main") });
    expect(row?.reservedMl).toBe(5000);
    expect(await database.select().from(orders)).toHaveLength(1);
  });

  it("allows only one of two concurrent customers to take the last package", async () => {
    // Separate clients model separate serverless function invocations.
    const firstClient = createDatabaseConnection(databaseUrl);
    const secondClient = createDatabaseConnection(databaseUrl);
    const results = await Promise.allSettled([
      submitOrder(firstClient.database, pickupInput("customer-one")),
      submitOrder(secondClient.database, pickupInput("customer-two")),
    ]);
    firstClient.close();
    secondClient.close();
    if (results.every((result) => result.status === "rejected")) {
      throw new Error(results.map((result) => result.status === "rejected" ? String(result.reason) : "ok").join(" | "));
    }
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const row = await database.query.availability.findFirst({ where: eq(availability.id, "availability-main") });
    expect(row?.reservedMl).toBe(5000);
    expect(await database.select().from(orders)).toHaveLength(1);
  });

  it("releases capacity once when a new order is cancelled", async () => {
    const receipt = await submitOrder(database, pickupInput("cancel-order"));
    const [created] = await database.select().from(orders).where(eq(orders.publicReference, receipt.publicReference));
    await transitionOrder(database, { orderId: created.id, status: "CANCELLED", expectedVersion: 1 });
    await expect(
      transitionOrder(database, { orderId: created.id, status: "CANCELLED", expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    const row = await database.query.availability.findFirst({ where: eq(availability.id, "availability-main") });
    expect(row?.reservedMl).toBe(0);
  });

  it("returns delivery as pending and rejects a manipulated public quantity at the route", async () => {
    const { POST } = await import("@/app/api/public/orders/route");
    const delivery = {
      ...pickupInput("delivery-request", "2099-08-14"),
      fulfillmentMethod: "DELIVERY",
      streetAddress: "Test street 1",
      postalCode: "00100",
      city: "Helsinki",
    };
    const response = await POST(new Request("http://localhost/api/public/orders", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(delivery),
    }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.deliveryFeeCents).toBeNull();
    expect(body.data.finalTotalCents).toBeNull();

    const invalid = await POST(new Request("http://localhost/api/public/orders", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...delivery, idempotencyKey: "manipulated-quantity", quantity: 2 }),
    }));
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).code).toBe("VALIDATION_ERROR");
  });
});
