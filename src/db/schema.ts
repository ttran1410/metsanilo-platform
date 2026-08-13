import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const shops = sqliteTable("shops", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nameFi: text("name_fi").notNull(),
  nameEn: text("name_en").notNull(),
  timezone: text("timezone").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  pickupNameFi: text("pickup_name_fi").notNull(),
  pickupNameEn: text("pickup_name_en").notNull(),
  pickupAddress: text("pickup_address").notNull(),
  pickupInstructionsFi: text("pickup_instructions_fi").notNull(),
  pickupInstructionsEn: text("pickup_instructions_en").notNull(),
  pickupTime: text("pickup_time").notNull().default("20:00"),
});

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    code: text("code").notNull(),
    slug: text("slug").notNull(),
    nameFi: text("name_fi").notNull(),
    nameEn: text("name_en").notNull(),
    descriptionFi: text("description_fi").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
    availableFrom: text("available_from").notNull(),
    availableThrough: text("available_through").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("products_shop_code_unique").on(table.shopId, table.code),
    check("products_valid_window", sql`${table.availableFrom} <= ${table.availableThrough}`),
  ],
);

export const packages = sqliteTable(
  "packages",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    productId: text("product_id").notNull().references(() => products.id),
    labelFi: text("label_fi").notNull(),
    labelEn: text("label_en").notNull(),
    volumeMl: integer("volume_ml").notNull(),
    priceCents: integer("price_cents").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    index("packages_shop_product_idx").on(table.shopId, table.productId),
    check("packages_positive_volume", sql`${table.volumeMl} > 0`),
    check("packages_nonnegative_price", sql`${table.priceCents} >= 0`),
  ],
);

export const availability = sqliteTable(
  "availability",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    productId: text("product_id").notNull().references(() => products.id),
    businessDate: text("business_date").notNull(),
    capacityMl: integer("capacity_ml").notNull(),
    reservedMl: integer("reserved_ml").notNull().default(0),
    acceptsOrders: integer("accepts_orders", { mode: "boolean" }).notNull().default(true),
    manualSoldOut: integer("manual_sold_out", { mode: "boolean" }).notNull().default(false),
    manualSoldOutReason: text("manual_sold_out_reason"),
    version: integer("version").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("availability_shop_product_date_unique").on(
      table.shopId,
      table.productId,
      table.businessDate,
    ),
    index("availability_shop_date_idx").on(table.shopId, table.businessDate),
    check("availability_nonnegative_capacity", sql`${table.capacityMl} >= 0`),
    check("availability_reserved_in_range", sql`${table.reservedMl} >= 0 AND ${table.reservedMl} <= ${table.capacityMl}`),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    publicReference: text("public_reference").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    productId: text("product_id").notNull().references(() => products.id),
    packageId: text("package_id").notNull().references(() => packages.id),
    productNameFi: text("product_name_fi").notNull(),
    productNameEn: text("product_name_en").notNull(),
    packageLabelFi: text("package_label_fi").notNull(),
    packageLabelEn: text("package_label_en").notNull(),
    quantity: integer("quantity").notNull(),
    volumeMl: integer("volume_ml").notNull(),
    itemSubtotalCents: integer("item_subtotal_cents").notNull(),
    deliveryFeeCents: integer("delivery_fee_cents"),
    finalTotalCents: integer("final_total_cents"),
    fulfillmentDate: text("fulfillment_date").notNull(),
    fulfillmentMethod: text("fulfillment_method", { enum: ["PICKUP", "DELIVERY"] }).notNull(),
    customerName: text("customer_name").notNull(),
    mobile: text("mobile").notNull(),
    email: text("email"),
    streetAddress: text("street_address"),
    postalCode: text("postal_code"),
    city: text("city"),
    pickupName: text("pickup_name"),
    pickupAddress: text("pickup_address"),
    pickupInstructions: text("pickup_instructions"),
    pickupTime: text("pickup_time"),
    notes: text("notes"),
    pickupConfirmedAt: text("pickup_confirmed_at"),
    pickupConfirmedBy: text("pickup_confirmed_by"),
    locale: text("locale", { enum: ["fi", "en"] }).notNull(),
    status: text("status", { enum: ["NEW", "CONFIRMED", "CANCELLED"] }).notNull().default("NEW"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("orders_shop_reference_unique").on(table.shopId, table.publicReference),
    uniqueIndex("orders_shop_idempotency_unique").on(table.shopId, table.idempotencyKey),
    index("orders_shop_created_idx").on(table.shopId, table.createdAt),
    check("orders_public_quantity_one", sql`${table.quantity} = 1`),
    check("orders_positive_volume", sql`${table.volumeMl} > 0`),
    check("orders_nonnegative_subtotal", sql`${table.itemSubtotalCents} >= 0`),
  ],
);

export const orderNotes = sqliteTable(
  "order_notes",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    orderId: text("order_id").notNull().references(() => orders.id),
    body: text("body").notNull(),
    actor: text("actor").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("order_notes_shop_order_idx").on(table.shopId, table.orderId, table.createdAt)],
);

export const orderPayments = sqliteTable(
  "order_payments",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    orderId: text("order_id").notNull().references(() => orders.id),
    amountCents: integer("amount_cents").notNull(),
    method: text("method", { enum: ["CASH", "BANK_TRANSFER", "CARD", "OTHER"] }).notNull(),
    reference: text("reference"),
    recordedAt: text("recorded_at").notNull(),
    actor: text("actor").notNull(),
  },
  (table) => [
    index("order_payments_shop_order_idx").on(table.shopId, table.orderId, table.recordedAt),
    check("order_payments_positive_amount", sql`${table.amountCents} > 0`),
  ],
);

export const auditEntries = sqliteTable(
  "audit_entries",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    detailsJson: text("details_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("audit_shop_created_idx").on(table.shopId, table.createdAt)],
);
