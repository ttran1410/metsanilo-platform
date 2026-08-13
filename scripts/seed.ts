import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { availability, packages, products, shops } from "../src/db/schema";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required seed variable: ${name}`);
  return value;
}

function positiveInteger(name: string) {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const availableFrom = required("SEED_AVAILABLE_FROM");
const availableThrough = required("SEED_AVAILABLE_THROUGH");
if (!datePattern.test(availableFrom) || !datePattern.test(availableThrough) || availableFrom > availableThrough) {
  throw new Error("Seed availability dates must be YYYY-MM-DD with start on or before end");
}

const shopId = process.env.SHOP_ID?.trim() || "shop-main";
const shopSlug = process.env.SHOP_SLUG?.trim() || "metsanilo";
const productCode = required("SEED_PRODUCT_CODE");
const safeCode = productCode.toLowerCase().replace(/[^a-z0-9-]/g, "-");
const productId = `product-${safeCode}`;
const packageId = `package-${safeCode}`;
const now = new Date().toISOString();
const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const database = drizzle(client);

await database
  .insert(shops)
  .values({
    id: shopId,
    slug: shopSlug,
    nameFi: required("SHOP_NAME_FI"),
    nameEn: required("SHOP_NAME_EN"),
    timezone: process.env.SHOP_TIMEZONE?.trim() || "Europe/Helsinki",
    active: true,
    pickupNameFi: required("PICKUP_NAME_FI"),
    pickupNameEn: required("PICKUP_NAME_EN"),
    pickupAddress: required("PICKUP_ADDRESS"),
    pickupInstructionsFi: required("PICKUP_INSTRUCTIONS_FI"),
    pickupInstructionsEn: required("PICKUP_INSTRUCTIONS_EN"),
    pickupTime: process.env.PICKUP_TIME?.trim() || "20:00",
  })
  .onConflictDoUpdate({
    target: shops.id,
    set: {
      slug: shopSlug,
      nameFi: required("SHOP_NAME_FI"),
      nameEn: required("SHOP_NAME_EN"),
      timezone: process.env.SHOP_TIMEZONE?.trim() || "Europe/Helsinki",
      pickupNameFi: required("PICKUP_NAME_FI"),
      pickupNameEn: required("PICKUP_NAME_EN"),
      pickupAddress: required("PICKUP_ADDRESS"),
      pickupInstructionsFi: required("PICKUP_INSTRUCTIONS_FI"),
      pickupInstructionsEn: required("PICKUP_INSTRUCTIONS_EN"),
      pickupTime: process.env.PICKUP_TIME?.trim() || "20:00",
    },
  });

await database
  .insert(products)
  .values({
    id: productId,
    shopId,
    code: productCode,
    slug: safeCode,
    nameFi: required("SEED_PRODUCT_NAME_FI"),
    nameEn: required("SEED_PRODUCT_NAME_EN"),
    availableFrom,
    availableThrough,
    active: true,
  })
  .onConflictDoUpdate({
    target: products.id,
    set: {
      nameFi: required("SEED_PRODUCT_NAME_FI"),
      nameEn: required("SEED_PRODUCT_NAME_EN"),
      availableFrom,
      availableThrough,
      active: true,
    },
  });

await database
  .insert(packages)
  .values({
    id: packageId,
    shopId,
    productId,
    labelFi: required("SEED_PACKAGE_LABEL_FI"),
    labelEn: required("SEED_PACKAGE_LABEL_EN"),
    volumeMl: positiveInteger("SEED_PACKAGE_ML"),
    priceCents: positiveInteger("SEED_PACKAGE_PRICE_CENTS"),
    active: true,
  })
  .onConflictDoUpdate({
    target: packages.id,
    set: {
      labelFi: required("SEED_PACKAGE_LABEL_FI"),
      labelEn: required("SEED_PACKAGE_LABEL_EN"),
      volumeMl: positiveInteger("SEED_PACKAGE_ML"),
      priceCents: positiveInteger("SEED_PACKAGE_PRICE_CENTS"),
      active: true,
    },
  });

for (
  let cursor = new Date(`${availableFrom}T00:00:00Z`);
  cursor <= new Date(`${availableThrough}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + 1)
) {
  const businessDate = cursor.toISOString().slice(0, 10);
  const id = `${shopId}:${productId}:${businessDate}`;
  await database
    .insert(availability)
    .values({
      id,
      shopId,
      productId,
      businessDate,
      capacityMl: positiveInteger("SEED_DAILY_CAPACITY_ML"),
      reservedMl: 0,
      acceptsOrders: true,
      manualSoldOut: false,
      version: 1,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: availability.id });
}

client.close();
console.log(`Seeded configured shop, product, package, and ${availableFrom}…${availableThrough} availability.`);
