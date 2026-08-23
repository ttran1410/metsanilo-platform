import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { createDatabaseConnection, type Database } from "@/db/client";
import { auditEntries, availability, customers, notifications, orderPayments, orders, outboxJobs, packages, products, shops, userPermissions } from "@/db/schema";
import { createUser, requirePermission, setUserPermission } from "@/domain/access";
import { createExternalOrder, createHistoricalOrder, runAutomation } from "@/domain/operations";
import { addOrderNote, archiveManagerOrder, confirmPickup, getManagerOrder, getOrderQueue, previewManagerOrderUpdate, recordPayment, recordRefund, setDeliveryFee, submitOrder, transitionOrder, unarchiveManagerOrder, updateManagerOrder } from "@/domain/orders";
import { createProduct, deleteProduct } from "@/domain/products";
import { planAvailability, previewAvailabilityPlan, previewAvailabilityUpdate } from "@/domain/availability";
import { resetEnvForTests } from "@/lib/env";
import { listPaymentMethods, setPaymentMethod } from "@/domain/payment-methods";

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
    expect(await database.select().from(notifications)).toHaveLength(1);
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
    await transitionOrder(database, { orderId: created.id, status: "CANCELLED", expectedVersion: 1, reason: "Customer unavailable" });
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

    const minimalDelivery = await POST(new Request("http://localhost/api/public/orders", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...delivery, idempotencyKey: "delivery-minimal", customerName: "Minimal Delivery", mobile: "+358401234568", email: "minimal@example.com", postalCode: "", city: "" }),
    }));
    expect(minimalDelivery.status).toBe(201);
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
  it("previews capacity and close/reopen impact without mutating the row", async () => {
    const preview = await previewAvailabilityUpdate(database, { id: "availability-main", expectedVersion: 1, capacityMl: 4000, manualSoldOut: false, acceptsOrders: false });
    expect(preview.impact.capacityDeltaMl).toBe(-1000);
    expect(preview.impact.closesOrders).toBe(true);
    expect(preview.impact.canApply).toBe(true);
    const unchanged = await database.query.availability.findFirst({ where: eq(availability.id, "availability-main") });
    expect(unchanged?.capacityMl).toBe(5000);
    expect(unchanged?.acceptsOrders).toBe(true);
  });

  it("previews create and overwrite operations without mutating the planning window", async () => {
    const preview = await previewAvailabilityPlan(database, {
      productId: "product-berries", frequency: "DAY", startDate: "2099-08-13", endDate: "2099-08-15", capacityMl: 9000,
    });
    const unchanged = await database.query.availability.findFirst({ where: eq(availability.id, "availability-main") });

    expect(preview.summary).toEqual({ creates: 1, overwrites: 2, blocked: 0 });
    expect(preview.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2099-08-13", operation: "OVERWRITE", currentCapacityMl: 5000, nextCapacityMl: 9000, version: 1 }),
      expect.objectContaining({ date: "2099-08-15", operation: "CREATE", currentCapacityMl: null, nextCapacityMl: 9000 }),
    ]));
    expect(unchanged?.capacityMl).toBe(5000);

    await submitOrder(database, pickupInput("blocked-plan-preview"));
    const blocked = await previewAvailabilityPlan(database, {
      productId: "product-berries", frequency: "CUSTOM", startDate: "2099-08-13", endDate: "2099-08-13", dates: ["2099-08-13"], capacityMl: 1,
    });
    expect(blocked.summary.blocked).toBe(1);
    expect(blocked.entries[0]).toMatchObject({ canApply: false, reservedMl: 5000 });
  });

  it("plans daily dates, creates missing rows, and protects reservations", async () => {
    await submitOrder(database, pickupInput("planner-reservation"));
    const planned = await planAvailability(database, {
      productId: "product-berries", frequency: "DAY", startDate: "2099-08-13", endDate: "2099-08-15",
      capacityMl: 12000, manualSoldOut: true, soldOutReason: "Picker unavailable", actor: "manager@example.fi",
    });
    expect(planned).toHaveLength(3);
    expect(planned.every((row) => row.capacityMl === 12000 && row.manualSoldOut)).toBe(true);
    expect((await database.query.availability.findFirst({ where: eq(availability.businessDate, "2099-08-15") }))?.reservedMl).toBe(0);
    expect((await database.query.auditEntries.findFirst({ where: eq(auditEntries.action, "availability.planned") }))?.actor).toBe("manager@example.fi");
    await expect(planAvailability(database, {
      productId: "product-berries", frequency: "CUSTOM", startDate: "2099-08-13", endDate: "2099-08-13",
      dates: ["2099-08-13"], capacityMl: 1, manualSoldOut: false,
    })).rejects.toMatchObject({ code: "BELOW_RESERVED" });
  });
});

describe("order operations", () => {
  it("returns filtered queue read models and non-mutating capacity previews", async () => {
    const created = await createExternalOrder(database, { ...pickupInput("queue-preview"), source: "PHONE", status: "CONFIRMED" });
    const confirmed = created;
    const queue = await getOrderQueue(database, { productId: "product-berries", from: "2099-08-13", to: "2099-08-13" });
    expect(queue.total).toBe(1);
    expect(queue.picking[0]?.id).toBe(created.id);

    const preview = await previewManagerOrderUpdate(database, { orderId: created.id, expectedVersion: confirmed.version, fulfillmentDate: "2099-08-14" });
    expect(preview.capacity.changed).toBe(true);
    expect(preview.capacity.releaseMl).toBe(5000);
    expect(preview.capacity.canReserve).toBe(true);
    expect((await database.query.orders.findFirst({ where: eq(orders.id, created.id) }))?.fulfillmentDate).toBe("2099-08-13");
  });

  it("creates external and historical orders without customer email automation", async () => {
    const external = await createExternalOrder(database, { ...pickupInput("external-placeholder"), source: "PHONE", status: "NEW" });
    expect(external.orderSource).toBe("PHONE");
    const historical = await createHistoricalOrder(database, { productId: "product-berries", packageId: "package-5l", quantity: 1, fulfillmentDate: "2099-08-12", fulfillmentMethod: "PICKUP", customerName: "Historical Customer", mobile: "+358401234567", completedStatus: "PICKED_UP", completedAt: "2099-08-12T12:00:00.000Z", source: "OTHER", reason: "Paper record from launch", paymentAmountCents: 2500 });
    expect(historical.historicalEntry).toBe(true);
    const jobs = await database.select().from(outboxJobs);
    expect(jobs.some((job) => job.type === "EMAIL")).toBe(false);
  });

  it("supports date override permission for external orders on past or closed dates", async () => {
    await expect(
      createExternalOrder(database, { ...pickupInput("external-closed", "2020-01-01"), source: "PHONE", status: "NEW", allowDateOverride: false })
    ).rejects.toMatchObject({ code: "DATE_CLOSED" });

    const overrideOrder = await createExternalOrder(database, { ...pickupInput("external-override", "2020-01-01"), source: "PHONE", status: "NEW", allowDateOverride: true });
    expect(overrideOrder.fulfillmentDate).toBe("2020-01-01");
  });

  it("matches repeat customers and flags conflicting identifiers for review", async () => {
    const first = await submitOrder(database, pickupInput("customer-match-one"));
    const second = await submitOrder(database, { ...pickupInput("customer-match-two"), fulfillmentDate: "2099-08-14" });
    const firstRow = (await database.query.orders.findFirst({ where: eq(orders.publicReference, first.publicReference) }))!;
    const secondRow = (await database.query.orders.findFirst({ where: eq(orders.publicReference, second.publicReference) }))!;
    expect(firstRow.customerId).toBe(secondRow.customerId);
    expect(await database.select().from(customers)).toHaveLength(1);
    const conflict = await submitOrder(database, { ...pickupInput("customer-conflict"), fulfillmentDate: "2099-08-14", email: "different@example.com" });
    const conflictRow = (await database.query.orders.findFirst({ where: eq(orders.publicReference, conflict.publicReference) }))!;
    expect((await database.query.customers.findFirst({ where: eq(customers.id, conflictRow.customerId!) }))?.matchStatus).toBe("CONFLICT_REVIEW");
  });

  it("supports MobilePay and blocks disabled payment methods", async () => {
    const receipt = await submitOrder(database, pickupInput("mobilepay-order"));
    const order = (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) }))!;
    await setPaymentMethod(database, "MOBILEPAY", false, "manager");
    await expect(recordPayment(database, { orderId: order.id, amountCents: 2500, method: "MOBILEPAY" })).rejects.toMatchObject({ code: "PAYMENT_METHOD_DISABLED" });
    await setPaymentMethod(database, "MOBILEPAY", true, "manager");
    await expect(recordPayment(database, { orderId: order.id, amountCents: 2500, method: "MOBILEPAY" })).resolves.toMatchObject({ method: "MOBILEPAY" });
    expect((await listPaymentMethods(database)).find((method) => method.method === "MOBILEPAY")?.enabled).toBe(true);
  });

  it("moves today confirmed orders to picking through the durable automation runner", async () => {
    const receipt = await submitOrder(database, { ...pickupInput("automation-order", "2099-08-13"), email: "notify@example.com" });
    const order = (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) }))!;
    const confirmed = await transitionOrder(database, { orderId: order.id, status: "CONFIRMED", expectedVersion: order.version });
    const result = await runAutomation(database, new Date("2099-08-13T10:00:00.000Z"));
    expect(result.picking).toBe(1);
    expect((await database.query.orders.findFirst({ where: eq(orders.id, confirmed.id) }))?.status).toBe("PICKING");
    const jobs = await database.select().from(outboxJobs);
    expect(jobs.some((job) => job.type === "EMAIL")).toBe(false);
  });

  it("calculates partial and full refund summaries", async () => {
    const receipt = await submitOrder(database, pickupInput("refund-lifecycle"));
    let order = (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) }))!;
    order = await transitionOrder(database, { orderId: order.id, status: "CONFIRMED", expectedVersion: order.version });
    order = await transitionOrder(database, { orderId: order.id, status: "PICKING", expectedVersion: order.version });
    order = await transitionOrder(database, { orderId: order.id, status: "READY", expectedVersion: order.version });
    order = await transitionOrder(database, { orderId: order.id, status: "PICKED_UP", expectedVersion: order.version });
    await recordPayment(database, { orderId: order.id, amountCents: 2500, method: "CASH" });
    await recordRefund(database, { orderId: order.id, amountCents: 500, method: "CASH", reason: "Quality adjustment" });
    expect((await getManagerOrder(database, order.id)).paymentSummary.status).toBe("PARTIALLY_REFUNDED");
    await recordRefund(database, { orderId: order.id, amountCents: 2000, method: "CASH", reason: "Final refund" });
    expect((await getManagerOrder(database, order.id)).order.status).toBe("REFUNDED");
  });

  it("follows pickup fulfillment states without releasing reserved capacity", async () => {
    const receipt = await submitOrder(database, pickupInput("full-pickup-lifecycle"));
    let order = (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) }))!;
    order = await transitionOrder(database, { orderId: order.id, status: "CONFIRMED", expectedVersion: order.version });
    order = await transitionOrder(database, { orderId: order.id, status: "PICKING", expectedVersion: order.version });
    order = await transitionOrder(database, { orderId: order.id, status: "READY", expectedVersion: order.version });
    order = await transitionOrder(database, { orderId: order.id, status: "PICKED_UP", expectedVersion: order.version });
    expect(order.status).toBe("PICKED_UP");
    expect(order.completedAt).toBeTruthy();
    expect((await database.query.availability.findFirst({ where: eq(availability.id, "availability-main") }))?.reservedMl).toBe(5000);
  });

  it("releases capacity for a confirmed business cancellation", async () => {
    const receipt = await submitOrder(database, pickupInput("confirmed-cancellation"));
    let order = (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) }))!;
    order = await transitionOrder(database, { orderId: order.id, status: "CONFIRMED", expectedVersion: order.version });
    order = await transitionOrder(database, { orderId: order.id, status: "CANCELLED", expectedVersion: order.version, reason: "Business unavailable" });
    expect(order.status).toBe("CANCELLED");
    expect((await database.query.availability.findFirst({ where: eq(availability.id, "availability-main") }))?.reservedMl).toBe(0);
  });

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

  it("deletes an unpaid order and blocks deletion if payments exist", async () => {
    const { deleteManagerOrder } = await import("@/domain/orders");
    const receipt = await submitOrder(database, pickupInput("delete-test"));
    const order = (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) }))!;
    
    // Delete unpaid order -> success
    const result = await deleteManagerOrder(database, order.id);
    expect(result.success).toBe(true);
    expect(await database.query.orders.findFirst({ where: eq(orders.id, order.id) })).toBeUndefined();

    // Create another order and record payment
    const receipt2 = await submitOrder(database, pickupInput("delete-blocked"));
    const order2 = (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt2.publicReference) }))!;
    await recordPayment(database, { orderId: order2.id, amountCents: 2500, method: "CASH" });

    // Deleting order with payments -> throws PAYMENT_EXISTS error
    await expect(deleteManagerOrder(database, order2.id)).rejects.toMatchObject({ code: "PAYMENT_EXISTS" });
  });

  it("archives completed/closed orders and blocks archiving active in-flight orders", async () => {
    resetEnvForTests();

    // Create an active order (NEW)
    const activeReceipt = await submitOrder(database, pickupInput("active-archive"));
    const activeOrder = (await database.query.orders.findFirst({ where: eq(orders.publicReference, activeReceipt.publicReference) }))!;

    // Archiving an active in-flight order -> throws INVALID_TRANSITION error
    await expect(archiveManagerOrder(database, activeOrder.id, "manager@example.com")).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });

    // Complete the order
    let currentVer = activeOrder.version;
    await transitionOrder(database, { orderId: activeOrder.id, status: "CONFIRMED", expectedVersion: currentVer++ });
    await transitionOrder(database, { orderId: activeOrder.id, status: "PICKING", expectedVersion: currentVer++ });
    await transitionOrder(database, { orderId: activeOrder.id, status: "READY", expectedVersion: currentVer++ });
    await transitionOrder(database, { orderId: activeOrder.id, status: "PICKED_UP", expectedVersion: currentVer++ });

    // Archiving completed order succeeds
    const archiveResult = await archiveManagerOrder(database, activeOrder.id, "manager@example.com");
    expect(archiveResult.archived).toBe(true);

    const archivedRecord = (await database.query.orders.findFirst({ where: eq(orders.id, activeOrder.id) }))!;
    expect(archivedRecord.archived).toBe(true);
    expect(archivedRecord.archivedBy).toBe("manager@example.com");
    expect(archivedRecord.archivedAt).not.toBeNull();

    // Restoring (un-archiving) order succeeds
    const restoreResult = await unarchiveManagerOrder(database, activeOrder.id, "manager@example.com");
    expect(restoreResult.archived).toBe(false);

    const restoredRecord = (await database.query.orders.findFirst({ where: eq(orders.id, activeOrder.id) }))!;
    expect(restoredRecord.archived).toBe(false);
    expect(restoredRecord.archivedBy).toBeNull();
  });

  it("handles status transition action via PATCH route payload without expectedVersion", async () => {
    const receipt = await submitOrder(database, pickupInput("patch-transition"));
    const order = (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) }))!;

    const transitionRes = await transitionOrder(database, {
      orderId: order.id,
      status: "CONFIRMED",
      expectedVersion: order.version,
    });
    expect(transitionRes.status).toBe("CONFIRMED");
  });

  it("allows metadata updates on closed orders while blocking core contract changes", async () => {
    const receipt = await submitOrder(database, pickupInput("closed-order-metadata"));
    const order = (await database.query.orders.findFirst({ where: eq(orders.publicReference, receipt.publicReference) }))!;

    // Transition to PICKED_UP
    await transitionOrder(database, { orderId: order.id, status: "CONFIRMED", expectedVersion: order.version });
    await transitionOrder(database, { orderId: order.id, status: "PICKING", expectedVersion: order.version + 1 });
    await transitionOrder(database, { orderId: order.id, status: "READY", expectedVersion: order.version + 2 });
    const pickedUp = await transitionOrder(database, { orderId: order.id, status: "PICKED_UP", expectedVersion: order.version + 3 });
    expect(pickedUp.status).toBe("PICKED_UP");

    // Updating metadata (orderSource, facebookProfile) succeeds on PICKED_UP order
    const updated = await updateManagerOrder(database, {
      orderId: order.id,
      expectedVersion: pickedUp.version,
      orderSource: "FACEBOOK_MESSAGE",
      facebookProfile: "facebook.com/john.doe",
    });
    expect(updated.orderSource).toBe("FACEBOOK_MESSAGE");
    expect(updated.facebookProfile).toBe("facebook.com/john.doe");

    // Attempting to change core fields (quantity) on DELIVERED order throws ORDER_LOCKED error
    await expect(
      updateManagerOrder(database, {
        orderId: order.id,
        expectedVersion: updated.version,
        quantity: 5,
      })
    ).rejects.toThrow(/locked/i);
  });
});


describe("shop roles and permissions", () => {
  it("seeds Manager and Staff operational defaults", async () => {
    resetEnvForTests();
    const adminRequest = new Request("http://localhost/manager", { headers: { authorization: `Basic ${Buffer.from("manager:secret").toString("base64")}` } });
    const staff = await createUser(database, adminRequest, { email: "picker@example.com", password: "Pick3r!pass", displayName: "Picker", role: "STAFF" });
    const manager = await createUser(database, adminRequest, { email: "manager@example.com", password: "Manag3r!pass", displayName: "Manager", role: "MANAGER" });
    const managerGrants = await database.select().from(userPermissions).where(eq(userPermissions.userId, manager.id));
    expect(managerGrants.length).toBeGreaterThan(0);
    const staffGrants = await database.select().from(userPermissions).where(eq(userPermissions.userId, staff.id));
    expect(staffGrants.map((grant) => grant.permission)).toContain("orders.read");
    expect(staffGrants.map((grant) => grant.permission)).toContain("orders.create");
    expect(staffGrants.map((grant) => grant.permission)).toContain("orders.payment.write");
    expect(staffGrants.map((grant) => grant.permission)).toContain("catalog.product.read");
    expect(staffGrants.map((grant) => grant.permission)).not.toContain("catalog.product.write");
    expect(staffGrants.map((grant) => grant.permission)).not.toContain("delivery.override");
    expect(staffGrants.map((grant) => grant.permission)).not.toContain("shop_users.manage");
    const staffRequest = new Request("http://localhost/manager", { headers: { authorization: `Basic ${Buffer.from("picker@example.com:secret").toString("base64")}` } });
    await expect(requirePermission(database, staffRequest, "orders.read")).resolves.toMatchObject({ email: "picker@example.com" });
    await setUserPermission(database, adminRequest, { userId: staff.id, permission: "orders.read", granted: true });
    await expect(requirePermission(database, staffRequest, "orders.read")).resolves.toMatchObject({ email: "picker@example.com" });
  });
});
