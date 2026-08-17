import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { availability, customers, packages, products, shops } from "@/db/schema";
import { createCustomer, getCustomerProfile, updateCustomer } from "@/domain/customers";
import { createExternalOrder, createHistoricalOrder } from "@/domain/operations";
import { submitOrder } from "@/domain/orders";
import { resetEnvForTests } from "@/lib/env";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-customer-fb-test-"));
let databaseUrl = "";
let database: Database;
let closeDatabase: () => void;
let testNumber = 0;

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

  await database.insert(products).values({
    id: "product-berries",
    shopId: "shop-default",
    code: "BERRY-5L",
    slug: "berries-5l",
    nameFi: "Mansikka 5L",
    nameEn: "Strawberry 5L",
    availableFrom: "2099-01-01",
    availableThrough: "2099-12-31",
  });

  await database.insert(packages).values({
    id: "package-5l",
    shopId: "shop-default",
    productId: "product-berries",
    labelFi: "5 Litran Laatikko",
    labelEn: "5 Litre Box",
    volumeMl: 5000,
    priceCents: 4000,
    active: true,
    sortOrder: 1,
  });

  await database.insert(availability).values({
    id: "avail-1",
    shopId: "shop-default",
    productId: "product-berries",
    businessDate: "2099-08-20",
    capacityMl: 1000000,
    reservedMl: 0,
    acceptsOrders: true,
    manualSoldOut: false,
    version: 1,
    updatedAt: new Date().toISOString(),
  });
});

afterAll(() => {
  if (closeDatabase) closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("Customer Facebook Profile CRM & Order Sync", () => {
  it("creates customer with facebookProfile and updates profile successfully", async () => {
    const created = await createCustomer(database, {
      name: "Maija Meikäläinen",
      mobile: "+358401234567",
      email: "maija@example.fi",
      facebookProfile: "https://facebook.com/maija.m",
    });

    expect(created.facebookProfile).toBe("https://facebook.com/maija.m");

    const updated = await updateCustomer(database, created.id, {
      facebookProfile: "@maija.facebook",
    });

    expect(updated.facebookProfile).toBe("@maija.facebook");
  });

  it("automatically syncs facebookProfile from order submit to customer record", async () => {
    await submitOrder(database, {
      locale: "fi",
      productId: "product-berries",
      packageId: "package-5l",
      quantity: 1,
      fulfillmentDate: "2099-08-20",
      fulfillmentMethod: "PICKUP",
      customerName: "Kalle Korhonen",
      mobile: "+358509998877",
      email: "kalle@example.fi",
      facebookProfile: "https://facebook.com/kalle.korhonen",
      idempotencyKey: "test-fb-sync-1234",
    });

    const found = await database.query.customers.findFirst({
      where: (c, { eq }) => eq(c.mobile, "+358509998877"),
    });

    expect(found).not.toBeNull();
    expect(found?.facebookProfile).toBe("https://facebook.com/kalle.korhonen");
  });

  it("automatically syncs facebookProfile when creating historical orders", async () => {
    await createHistoricalOrder(database, {
      productId: "product-berries",
      packageId: "package-5l",
      quantity: 1,
      fulfillmentDate: "2099-08-10",
      fulfillmentMethod: "PICKUP",
      customerName: "Liisa Virtanen",
      mobile: "+358451112233",
      email: "liisa@example.fi",
      facebookProfile: "@liisa.virtanen",
      completedStatus: "PICKED_UP",
      completedAt: "2099-08-10T12:00:00Z",
      source: "FACEBOOK",
      reason: "Historical FB order",
    });

    const found = await database.query.customers.findFirst({
      where: (c, { eq }) => eq(c.mobile, "+358451112233"),
    });

    expect(found).not.toBeNull();
    expect(found?.facebookProfile).toBe("@liisa.virtanen");
  });

  it("allows order creation without mobile number when facebookProfile is provided", async () => {
    await submitOrder(database, {
      locale: "fi",
      productId: "product-berries",
      packageId: "package-5l",
      quantity: 1,
      fulfillmentDate: "2099-08-20",
      fulfillmentMethod: "PICKUP",
      customerName: "Facebook Only Customer",
      facebookProfile: "https://facebook.com/fb.only.user",
      idempotencyKey: "test-fb-no-phone-99",
    });

    const found = await database.query.customers.findFirst({
      where: (c, { eq }) => eq(c.facebookProfile, "https://facebook.com/fb.only.user"),
    });

    expect(found).not.toBeNull();
    expect(found?.name).toBe("Facebook Only Customer");
    expect(found?.mobile).toBeNull();
  });

  it("creates customer with only facebookProfile and no mobile number", async () => {
    const created = await createCustomer(database, {
      name: "Facebook Only Customer CRM",
      facebookProfile: "https://facebook.com/fb.only.crm",
    });

    expect(created.name).toBe("Facebook Only Customer CRM");
    expect(created.mobile).toBeNull();
    expect(created.facebookProfile).toBe("https://facebook.com/fb.only.crm");

    await expect(
      createCustomer(database, {
        name: "No Contact Info Customer",
      })
    ).rejects.toThrow("At least one contact method");
  });

  it("updates existing customer by removing mobile number and adding facebookProfile", async () => {
    const created = await createCustomer(database, {
      name: "Existing Mobile Customer",
      mobile: "+358409990000",
    });

    expect(created.mobile).toBe("+358409990000");

    const updated = await updateCustomer(database, created.id, {
      mobile: "",
      facebookProfile: "https://facebook.com/new.fb.handle",
    });

    expect(updated.mobile).toBeNull();
    expect(updated.facebookProfile).toBe("https://facebook.com/new.fb.handle");
  });

  it("creates external order with facebookProfile and no mobile number via API route", async () => {
    const { POST } = await import("@/app/api/admin/orders/external/route");
    const { users } = await import("@/db/schema");
    const { hashPassword } = await import("@/domain/passwords");
    const passwordHash = await hashPassword("Password123!");
    await database.insert(users).values({
      id: "user-admin-external-test",
      shopId: "shop-default",
      email: "admin-ext@example.com",
      displayName: "Admin External User",
      passwordHash,
      role: "ADMIN",
      active: true,
      createdAt: new Date().toISOString(),
    });

    const req = new Request("http://localhost/api/admin/orders/external", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Basic " + Buffer.from("admin-ext@example.com:Password123!").toString("base64"),
      },
      body: JSON.stringify({
        productId: "product-berries",
        packageId: "package-5l",
        quantity: 1,
        fulfillmentDate: "2099-08-20",
        fulfillmentMethod: "PICKUP",
        customerName: "Riitta Seppä",
        facebookProfile: "riitta.seppa.5",
        city: "Pori",
        source: "FACEBOOK",
        deliveryFeeCents: 0,
        status: "NEW",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.facebookProfile).toBe("riitta.seppa.5");
    expect(json.data.mobile).toBeNull();
    expect(json.data.orderSource).toBe("FACEBOOK");
  });

  it("does not report identity conflicts for customers without mobile number unless another record shares facebookProfile or email", async () => {
    const customerNoMobile = await createCustomer(database, {
      name: "Riitta Seppä",
      facebookProfile: "riitta.seppa.5",
    });

    await createCustomer(database, {
      name: "Ismo Rinne",
      mobile: "+358504679703",
    });

    const profile1 = await getCustomerProfile(database, customerNoMobile.id);
    expect(profile1?.identityConflicts).toHaveLength(0);

    const duplicateFbCustomer = await createCustomer(database, {
      name: "Riitta Seppä Alternate Profile",
      facebookProfile: "riitta.seppa.6",
    });

    await updateCustomer(database, duplicateFbCustomer.id, {
      facebookProfile: "riitta.seppa.5",
    });

    const profile2 = await getCustomerProfile(database, customerNoMobile.id);
    expect(profile2?.identityConflicts).toHaveLength(1);
    expect(profile2?.identityConflicts[0].id).toBe(duplicateFbCustomer.id);
  });
});
