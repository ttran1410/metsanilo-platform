import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { createDatabaseConnection, type Database } from "@/db/client";
import { availability, orderPayments, orders, packages, products, shops } from "@/db/schema";
import { createUser, requirePermission, setUserPermission } from "@/domain/access";
import { addOrderNote, confirmPickup, getManagerOrder, recordPayment, setDeliveryFee, submitOrder, transitionOrder } from "@/domain/orders";
import { createProduct, deleteProduct } from "@/domain/products";
import { planAvailability } from "@/domain/availability";
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
  await database.insert(packages).values({
    id: "package-10l", shopId: "shop-main", productId: "product-berries",
    labelFi: "10 litraa", labelEn: "10 litres", volumeMl: 10000, priceCents: 4500, active: true,
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
  it("allows quantity selection only for the 10 litre package", async () => {
    await expect(submitOrder(database, { ...pickupInput("invalid-quantity"), quantity: 2 })).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
    await database.update(availability).set({ capacityMl: 30000 }).where(eq(availability.id, "availability-main"));
    const receipt = await submitOrder(database, { ...pickupInput("ten-litre-quantity"), packageId: "package-10l", quantity: 2 });
    expect(receipt.volumeMl).toBe(20000);
    expect(receipt.itemSubtotalCents).toBe(9000);
    const row = await database.query.availability.findFirst({ where: eq(availability.id, "availability-main") });
    expect(row?.reservedMl).toBe(20000);
  });
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
    expect((await invalid.json()).code).toBe("INVALID_QUANTITY");
  });
});

describe("product module", () => {
  it("creates a bilingual product with a package and refuses deletion after use", async () => {
    const created = await createProduct(database, {
      code: "MUSHROOMS", slug: "mushrooms", nameFi: "Sienet", nameEn: "Mushrooms",
      descriptionFi: "Metsäsieniä", descriptionEn: "Forest mushrooms", availableFrom: "2099-08-13", availableThrough: "2099-09-30", active: true,
      packages: [{ labelFi: "Kilo", labelEn: "Kilogram", volumeMl: 1000, priceCents: 1200, active: true }],
    });
    expect(created.product.descriptionFi).toBe("Metsäsieniä");
    expect(created.packages).toHaveLength(1);
    await expect(createProduct(database, {
      code: "MUSHROOMS", slug: "another", nameFi: "Toiset", nameEn: "Other", descriptionFi: "", descriptionEn: "",
      availableFrom: "2099-08-13", availableThrough: "2099-09-30", active: true,
      packages: [{ labelFi: "Kilo", labelEn: "Kilogram", volumeMl: 1000, priceCents: 1200, active: true }],
    })).rejects.toMatchObject({ code: "DUPLICATE_PRODUCT" });
    await expect(deleteProduct(database, "product-berries")).rejects.toMatchObject({ code: "PRODUCT_IN_USE" });
    await expect(deleteProduct(database, created.product.id)).resolves.toMatchObject({ deleted: true });
  });
});

describe("availability planning", () => {
  it("plans daily dates, creates missing rows, and protects reservations", async () => {
    await submitOrder(database, pickupInput("planner-reservation"));
    const planned = await planAvailability(database, {
      productId: "product-berries", frequency: "DAY", startDate: "2099-08-13", endDate: "2099-08-15",
      capacityMl: 12000, manualSoldOut: true, soldOutReason: "Picker unavailable",
    });
    expect(planned).toHaveLength(3);
    expect(planned.every((row) => row.capacityMl === 12000 && row.manualSoldOut)).toBe(true);
    expect((await database.query.availability.findFirst({ where: eq(availability.businessDate, "2099-08-15") }))?.reservedMl).toBe(0);
    await expect(planAvailability(database, {
      productId: "product-berries", frequency: "CUSTOM", startDate: "2099-08-13", endDate: "2099-08-13",
      dates: ["2099-08-13"], capacityMl: 1, manualSoldOut: false,
    })).rejects.toMatchObject({ code: "BELOW_RESERVED" });
  });
});

describe("order operations", () => {
  it("sets a manual delivery fee, records payment, and adds a note", async () => {
    const receipt = await submitOrder(database, {
      ...pickupInput("delivery-operations", "2099-08-14"), fulfillmentMethod: "DELIVERY",
      streetAddress: "Test street 1", postalCode: "00100", city: "Helsinki",
    });
    await expect(recordPayment(database, { orderId: (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) }))!.id, amountCents: 2500, method: "CARD" })).rejects.toMatchObject({ code: "DELIVERY_FEE_PENDING" });
    const order = (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) }))!;
    const updated = await setDeliveryFee(database, { orderId: order.id, expectedVersion: order.version, deliveryFeeCents: 500 });
    await recordPayment(database, { orderId: order.id, amountCents: 3000, method: "CARD", reference: "terminal-1" });
    await addOrderNote(database, { orderId: order.id, body: "Customer called about delivery." });
    const detail = await getManagerOrder(database, order.id);
    expect(updated.finalTotalCents).toBe(3000);
    expect(detail.payments).toHaveLength(1);
    expect(detail.notes[0]?.body).toContain("delivery");
    expect(await database.select().from(orderPayments)).toHaveLength(1);
  });

  it("confirms pickup only after the order is confirmed", async () => {
    const receipt = await submitOrder(database, pickupInput("pickup-confirm"));
    const order = (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) }))!;
    await expect(confirmPickup(database, { orderId: order.id, expectedVersion: order.version })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    const confirmed = await transitionOrder(database, { orderId: order.id, status: "CONFIRMED", expectedVersion: order.version });
    const picked = await confirmPickup(database, { orderId: order.id, expectedVersion: confirmed.version });
    expect(picked.pickupConfirmedAt).toBeTruthy();
  });
});

describe("shop roles and permissions", () => {
  it("allows Manager assignment but requires explicit Staff grants", async () => {
    process.env.MANAGER_USERNAME = "manager";
    resetEnvForTests();
    const adminRequest = new Request("http://localhost/manager", { headers: { authorization: `Basic ${Buffer.from("manager:secret").toString("base64")}` } });
    const staff = await createUser(database, adminRequest, { username: "picker", displayName: "Picker", role: "STAFF" });
    const staffRequest = new Request("http://localhost/manager", { headers: { authorization: `Basic ${Buffer.from("picker:secret").toString("base64")}` } });
    await expect(requirePermission(database, staffRequest, "orders.read")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setUserPermission(database, adminRequest, { userId: staff.id, permission: "orders.read", granted: true });
    await expect(requirePermission(database, staffRequest, "orders.read")).resolves.toMatchObject({ username: "picker" });
  });
});
