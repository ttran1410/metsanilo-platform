import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { createDatabaseConnection, type Database } from "@/db/client";
import { auditEntries, availability, customers, notifications, orders, outboxJobs, packages, products, shops } from "@/db/schema";
import { createExternalOrder, createHistoricalOrder } from "@/domain/operations";
import { submitOrder } from "@/domain/orders";
import { intakeOrderCore } from "@/domain/order-intake";
import { resetEnvForTests } from "@/lib/env";
import type { AdminActionActor } from "@/domain/admin-action-context";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-intake-test-"));
let databaseUrl = "";
let database: Database;
let testNumber = 0;

const defaultActor: AdminActionActor = {
  id: "admin-1",
  role: "ADMIN",
  shopId: "shop-main",
  email: "admin@metsanilo.fi",
};

const defaultPickupInput = (key: string, date = "2099-08-13") => ({
  shopId: "shop-main",
  locale: "fi" as const,
  productId: "product-berries",
  packageId: "package-5l",
  quantity: 1,
  fulfillmentDate: date,
  fulfillmentMethod: "PICKUP" as const,
  customerName: "Test Customer",
  mobile: "+358401234567",
  email: "test@example.com",
  idempotencyKey: key,
});

beforeEach(async () => {
  testNumber += 1;
  databaseUrl = `file:${join(directory, `test-${testNumber}.db`)}`;
  process.env.TURSO_DATABASE_URL = databaseUrl;
  process.env.SHOP_ID = "shop-main";
  resetEnvForTests();
  const connection = createDatabaseConnection(databaseUrl);
  database = connection.database;
  await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });

  await database.insert(shops).values([
    {
      id: "shop-main",
      slug: "main",
      nameFi: "Testikauppa",
      nameEn: "Test shop",
      timezone: "Europe/Helsinki",
      active: true,
      pickupNameFi: "Nouto",
      pickupNameEn: "Pickup",
      pickupAddress: "Main address",
      pickupInstructionsFi: "Ohje",
      pickupInstructionsEn: "Instruction",
      pickupTime: "20:00",
    },
    {
      id: "shop-other",
      slug: "other",
      nameFi: "Toinen",
      nameEn: "Other",
      timezone: "Europe/Helsinki",
      active: true,
      pickupNameFi: "Toinen nouto",
      pickupNameEn: "Other pickup",
      pickupAddress: "Other address",
      pickupInstructionsFi: "Muu",
      pickupInstructionsEn: "Other",
      pickupTime: "20:00",
    },
  ]);

  await database.insert(products).values([
    {
      id: "product-berries",
      shopId: "shop-main",
      code: "mansikka",
      slug: "mansikka",
      nameFi: "Mansikka",
      nameEn: "Strawberry",
      descriptionFi: "Tuore",
      descriptionEn: "Fresh",
      availableFrom: "2099-08-01",
      availableThrough: "2099-08-31",
      active: true,
      showOnHomepage: true,
      showOnReserve: true,
      sortOrder: 1,
    },
  ]);

  await database.insert(packages).values([
    {
      id: "package-5l",
      shopId: "shop-main",
      productId: "product-berries",
      labelFi: "5 litraa",
      labelEn: "5 litres",
      volumeMl: 5000,
      priceCents: 2500,
      active: true,
      sortOrder: 1,
      isDefault: true,
    },
  ]);

  await database.insert(availability).values([
    {
      id: "avail-1",
      shopId: "shop-main",
      productId: "product-berries",
      seasonId: null,
      businessDate: "2099-08-13",
      capacityMl: 10000,
      reservedMl: 0,
      acceptsOrders: true,
      manualSoldOut: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
});

describe("order intake transaction core & policies", () => {
  it("rejects mismatched shopId or actor/shop mismatch with FORBIDDEN without performing writes", async () => {
    await expect(
      intakeOrderCore(database, {
        ...defaultPickupInput("shop-mismatch"),
        channel: "PUBLIC",
        shopId: "shop-other",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    await expect(
      createExternalOrder(database, {
        ...defaultPickupInput("actor-mismatch"),
        shopId: "shop-main",
        actor: { id: "admin-2", role: "ADMIN", shopId: "shop-other", email: "other@metsanilo.fi" },
        source: "PHONE",
        status: "NEW",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    expect(await database.select().from(orders)).toHaveLength(0);
    expect(await database.select().from(customers)).toHaveLength(0);
    expect(await database.select().from(auditEntries)).toHaveLength(0);
  });

  it("replays existing external order with same idempotency key and normalized payload with 0 side effects", async () => {
    const input = {
      ...defaultPickupInput("idem-replay-1"),
      shopId: "shop-main",
      actor: defaultActor,
      source: "PHONE" as const,
      status: "NEW" as const,
    };

    const first = await createExternalOrder(database, input);
    const auditsBefore = await database.select().from(auditEntries);
    const notifsBefore = await database.select().from(notifications);
    const outboxBefore = await database.select().from(outboxJobs);
    const availBefore = (await database.query.availability.findFirst({ where: eq(availability.id, "avail-1") }))!;

    const second = await createExternalOrder(database, input);
    expect(second.id).toBe(first.id);
    expect(second.publicReference).toBe(first.publicReference);

    const auditsAfter = await database.select().from(auditEntries);
    const notifsAfter = await database.select().from(notifications);
    const outboxAfter = await database.select().from(outboxJobs);
    const availAfter = (await database.query.availability.findFirst({ where: eq(availability.id, "avail-1") }))!;

    expect(auditsAfter).toHaveLength(auditsBefore.length);
    expect(notifsAfter).toHaveLength(notifsBefore.length);
    expect(outboxAfter).toHaveLength(outboxBefore.length);
    expect(availAfter.reservedMl).toBe(availBefore.reservedMl);
  });

  it("rejects same idempotency key with materially different payload with IDEMPOTENCY_CONFLICT", async () => {
    await createExternalOrder(database, {
      ...defaultPickupInput("idem-conflict-1"),
      shopId: "shop-main",
      actor: defaultActor,
      source: "PHONE",
      status: "NEW",
    });

    await expect(
      createExternalOrder(database, {
        ...defaultPickupInput("idem-conflict-1"),
        customerName: "Different Name",
        shopId: "shop-main",
        actor: defaultActor,
        source: "PHONE",
        status: "NEW",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", status: 409 });
  });

  it("allows two otherwise identical legitimate orders with different idempotency keys", async () => {
    const first = await createExternalOrder(database, {
      ...defaultPickupInput("order-key-1"),
      shopId: "shop-main",
      actor: defaultActor,
      source: "PHONE",
      status: "CONFIRMED",
    });

    const second = await createExternalOrder(database, {
      ...defaultPickupInput("order-key-2"),
      shopId: "shop-main",
      actor: defaultActor,
      source: "PHONE",
      status: "CONFIRMED",
    });

    expect(first.id).not.toBe(second.id);
    expect(first.publicReference).not.toBe(second.publicReference);
    const avail = (await database.query.availability.findFirst({ where: eq(availability.id, "avail-1") }))!;
    expect(avail.reservedMl).toBe(10000);
  });

  it("rolls back all state changes deterministically when a failure occurs after capacity reservation", async () => {
    const ordersBefore = await database.select().from(orders);
    const customersBefore = await database.select().from(customers);
    const auditsBefore = await database.select().from(auditEntries);
    const outboxBefore = await database.select().from(outboxJobs);
    const notifsBefore = await database.select().from(notifications);
    const availBefore = (await database.query.availability.findFirst({ where: eq(availability.id, "avail-1") }))!;

    await expect(
      intakeOrderCore(
        database,
        {
          ...defaultPickupInput("rollback-seam"),
          channel: "EXTERNAL",
          shopId: "shop-main",
          actor: defaultActor,
          source: "PHONE",
          status: "NEW",
        },
        {
          afterReservation: async () => {
            throw new Error("Controlled test fault after reservation");
          },
        },
      ),
    ).rejects.toThrow("Controlled test fault after reservation");

    const ordersAfter = await database.select().from(orders);
    const customersAfter = await database.select().from(customers);
    const auditsAfter = await database.select().from(auditEntries);
    const outboxAfter = await database.select().from(outboxJobs);
    const notifsAfter = await database.select().from(notifications);
    const availAfter = (await database.query.availability.findFirst({ where: eq(availability.id, "avail-1") }))!;

    expect(ordersAfter).toHaveLength(ordersBefore.length);
    expect(customersAfter).toHaveLength(customersBefore.length);
    expect(auditsAfter).toHaveLength(auditsBefore.length);
    expect(outboxAfter).toHaveLength(outboxBefore.length);
    expect(notifsAfter).toHaveLength(notifsBefore.length);
    expect(availAfter.reservedMl).toBe(availBefore.reservedMl);
  });

  it("enforces capacity limit even when date override is enabled", async () => {
    await database
      .update(availability)
      .set({ capacityMl: 5000, reservedMl: 5000 })
      .where(eq(availability.id, "avail-1"));

    await expect(
      createExternalOrder(database, {
        ...defaultPickupInput("override-full-date"),
        shopId: "shop-main",
        actor: defaultActor,
        source: "PHONE",
        status: "NEW",
        allowDateOverride: true,
      }),
    ).rejects.toMatchObject({ code: "CAPACITY_CHANGED", status: 409 });
  });

  it("allows only one success under concurrent race for the last capacity slot", async () => {
    // Availability has 10000 capacity; reserve 5000 so only 5000 is left (1 slot)
    await database
      .update(availability)
      .set({ capacityMl: 10000, reservedMl: 5000 })
      .where(eq(availability.id, "avail-1"));

    const input1 = {
      ...defaultPickupInput("race-order-1"),
      shopId: "shop-main",
      actor: defaultActor,
      source: "PHONE" as const,
      status: "NEW" as const,
    };
    const input2 = {
      ...defaultPickupInput("race-order-2"),
      shopId: "shop-main",
      actor: defaultActor,
      source: "PHONE" as const,
      status: "NEW" as const,
    };

    const results = await Promise.allSettled([
      createExternalOrder(database, input1),
      createExternalOrder(database, input2),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const rejections = results.filter((r) => r.status === "rejected");

    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);
    const avail = (await database.query.availability.findFirst({ where: eq(availability.id, "avail-1") }))!;
    expect(avail.reservedMl).toBe(10000);
  });

  it("uses actor email when present and actor id otherwise in audit entries", async () => {
    const orderWithEmail = await createExternalOrder(database, {
      ...defaultPickupInput("actor-email-test"),
      shopId: "shop-main",
      actor: { id: "user-1", role: "ADMIN", shopId: "shop-main", email: "staff@metsanilo.fi" },
      source: "PHONE",
      status: "CONFIRMED",
      allowDateOverride: true,
    });

    const auditsWithEmail = await database.select().from(auditEntries).where(eq(auditEntries.entityId, orderWithEmail.id));
    expect(auditsWithEmail.every((a) => a.actor === "staff@metsanilo.fi")).toBe(true);

    const orderWithoutEmail = await createExternalOrder(database, {
      ...defaultPickupInput("actor-no-email-test"),
      shopId: "shop-main",
      actor: { id: "user-99", role: "MANAGER", shopId: "shop-main", email: null },
      source: "PHONE",
      status: "CONFIRMED",
      allowDateOverride: true,
    });

    const auditsWithoutEmail = await database.select().from(auditEntries).where(eq(auditEntries.entityId, orderWithoutEmail.id));
    expect(auditsWithoutEmail.every((a) => a.actor === "user-99")).toBe(true);
  });

  it("creates NEW_ORDER notification/outbox for external NEW orders, but NOT for external CONFIRMED orders", async () => {
    const newOrder = await createExternalOrder(database, {
      ...defaultPickupInput("external-new-notif"),
      shopId: "shop-main",
      actor: defaultActor,
      source: "PHONE",
      status: "NEW",
      allowDateOverride: true,
    });

    const newNotifs = await database.select().from(notifications).where(eq(notifications.orderId, newOrder.id));
    const newOutbox = await database.select().from(outboxJobs).where(eq(outboxJobs.eventKey, `order:${newOrder.id}:new:v1`));
    expect(newNotifs).toHaveLength(1);
    expect(newOutbox).toHaveLength(1);

    const confirmedOrder = await createExternalOrder(database, {
      ...defaultPickupInput("external-confirmed-notif"),
      shopId: "shop-main",
      actor: defaultActor,
      source: "PHONE",
      status: "CONFIRMED",
      allowDateOverride: true,
    });

    const confirmedNotifs = await database.select().from(notifications).where(eq(notifications.orderId, confirmedOrder.id));
    const confirmedOutbox = await database.select().from(outboxJobs).where(eq(outboxJobs.eventKey, `order:${confirmedOrder.id}:new:v1`));
    expect(confirmedNotifs).toHaveLength(0);
    expect(confirmedOutbox).toHaveLength(0);
  });

  it("enforces pickup and delivery pricing rules matching frozen matrix", async () => {
    const pickupOrder = await createExternalOrder(database, {
      ...defaultPickupInput("pricing-pickup", "2099-08-13"),
      shopId: "shop-main",
      actor: defaultActor,
      source: "PHONE",
      status: "CONFIRMED",
      allowDateOverride: true,
    });
    expect(pickupOrder.deliveryFeeCents).toBe(0);
    expect(pickupOrder.finalTotalCents).toBe(2500);

    const deliveryWithFee = await createExternalOrder(database, {
      ...defaultPickupInput("pricing-delivery-fee", "2099-08-14"),
      fulfillmentMethod: "DELIVERY",
      streetAddress: "Katu 1",
      postalCode: "00100",
      city: "Helsinki",
      deliveryFeeCents: 600,
      shopId: "shop-main",
      actor: defaultActor,
      source: "PHONE",
      status: "CONFIRMED",
      allowDateOverride: true,
    });
    expect(deliveryWithFee.deliveryFeeCents).toBe(600);
    expect(deliveryWithFee.finalTotalCents).toBe(3100);

    const deliveryPendingFee = await createExternalOrder(database, {
      ...defaultPickupInput("pricing-delivery-pending", "2099-08-15"),
      fulfillmentMethod: "DELIVERY",
      streetAddress: "Katu 1",
      postalCode: "00100",
      city: "Helsinki",
      deliveryFeeCents: null,
      shopId: "shop-main",
      actor: defaultActor,
      source: "PHONE",
      status: "CONFIRMED",
      allowDateOverride: true,
    });
    expect(deliveryPendingFee.deliveryFeeCents).toBeNull();
    expect(deliveryPendingFee.finalTotalCents).toBeNull();
    expect(deliveryPendingFee.contactedBy).toBe("admin@metsanilo.fi");
    expect(deliveryPendingFee.contactChannel).toBe("PHONE");
  });

  it("submits public order with exact backward-compatible receipt shape", async () => {
    const receipt = await submitOrder(database, {
      locale: "fi",
      productId: "product-berries",
      packageId: "package-5l",
      quantity: 1,
      fulfillmentDate: "2099-08-13",
      fulfillmentMethod: "PICKUP",
      customerName: "Public User",
      mobile: "+358401234567",
      email: "public@example.com",
      idempotencyKey: "public-order-receipt",
    });

    expect(receipt).toMatchObject({
      locale: "fi",
      productName: "Mansikka",
      packageLabel: "5 litraa",
      volumeMl: 5000,
      itemSubtotalCents: 2500,
      deliveryFeeCents: 0,
      finalTotalCents: 2500,
      fulfillmentDate: "2099-08-13",
      fulfillmentMethod: "PICKUP",
      status: "NEW",
    });
    expect(receipt.pickup).toBeDefined();
    expect(receipt.pickup?.name).toBe("Nouto");
  });

  it("preserves createHistoricalOrder behavior with 0 capacity deductions", async () => {
    const availBefore = (await database.query.availability.findFirst({ where: eq(availability.id, "avail-1") }))!;
    const historical = await createHistoricalOrder(database, {
      productId: "product-berries",
      packageId: "package-5l",
      quantity: 1,
      fulfillmentDate: "2099-08-13",
      fulfillmentMethod: "PICKUP",
      customerName: "Historical Customer",
      mobile: "+358401234567",
      completedStatus: "PICKED_UP",
      completedAt: "2099-08-13T12:00:00.000Z",
      source: "OTHER",
      reason: "Paper record intake",
      paymentAmountCents: 2500,
    });

    expect(historical.historicalEntry).toBe(true);
    const availAfter = (await database.query.availability.findFirst({ where: eq(availability.id, "avail-1") }))!;
    expect(availAfter.reservedMl).toBe(availBefore.reservedMl);
  });
});
