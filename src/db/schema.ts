import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  contactPhone: text("contact_phone").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  contactHours: text("contact_hours").notNull().default(""),
  businessName: text("business_name"),
  businessId: text("business_id"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  reviewsVisible: integer("reviews_visible", { mode: "boolean" }).notNull().default(true),
  howItWorksVisible: integer("how_it_works_visible", { mode: "boolean" }).notNull().default(true),
  aboutUsVisible: integer("about_us_visible", { mode: "boolean" }).notNull().default(true),
  ratingAvg: real("rating_avg").notNull().default(5.0),
  reviewCount: integer("review_count").notNull().default(0),
  starDistributionJson: text("star_distribution_json").notNull().default('{"5":0,"4":0,"3":0,"2":0,"1":0}'),
});

export const orderSources = sqliteTable("order_sources", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  key: text("key").notNull(),
  labelFi: text("label_fi").notNull(),
  labelEn: text("label_en").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("order_sources_shop_key_unique").on(table.shopId, table.key), index("order_sources_shop_active_idx").on(table.shopId, table.active, table.sortOrder)]);

export const fulfillmentLocations = sqliteTable("fulfillment_locations", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  type: text("type", { enum: ["PICKUP", "DELIVERY_ORIGIN"] }).notNull(),
  nameFi: text("name_fi").notNull(),
  nameEn: text("name_en").notNull(),
  address: text("address").notNull(),
  instructionsFi: text("instructions_fi").notNull().default(""),
  instructionsEn: text("instructions_en").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("fulfillment_locations_shop_type_idx").on(table.shopId, table.type, table.active)]);

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    name: text("name").notNull(),
    mobile: text("mobile"),
    email: text("email"),
    matchStatus: text("match_status", { enum: ["ACTIVE", "CONFLICT_REVIEW"] }).notNull().default("ACTIVE"),
    marketingConsent: integer("marketing_consent", { mode: "boolean" }).notNull().default(false),
    marketingConsentStatus: text("marketing_consent_status", { enum: ["NOT_CONSENTED", "CONSENTED", "REVOKED"] }).notNull().default("NOT_CONSENTED"),
    marketingConsentAt: text("marketing_consent_at"),
    marketingConsentSource: text("marketing_consent_source", { enum: ["ORDER_FORM", "ADMIN", "MANUAL"] }),
    marketingConsentUpdatedBy: text("marketing_consent_updated_by"),
    notes: text("notes"),
    facebookProfile: text("facebook_profile"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("customers_shop_mobile_idx").on(table.shopId, table.mobile), index("customers_shop_email_idx").on(table.shopId, table.email)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    customerId: text("customer_id").references(() => customers.id),
    orderId: text("order_id").references(() => orders.id),
    productId: text("product_id").references(() => products.id),
    displayName: text("display_name").notNull(),
    contact: text("contact"),
    rating: integer("rating").notNull(),
    originalText: text("original_text").notNull(),
    displayText: text("display_text"),
    source: text("source", { enum: ["PUBLIC_FORM", "MANUAL_IMPORT"] }).notNull().default("PUBLIC_FORM"),
    status: text("status", { enum: ["PENDING", "PENDING_CONFIRMATION", "APPROVED", "REJECTED", "HIDDEN", "ARCHIVED"] }).notNull().default("PENDING"),
    publicationAcknowledgement: integer("publication_acknowledgement", { mode: "boolean" }).notNull().default(false),
    acknowledgementSource: text("acknowledgement_source", { enum: ["PUBLIC_FORM", "SMS", "WHATSAPP", "PHONE", "OTHER"] }),
    acknowledgedAt: text("acknowledged_at"),
    verifiedBuyer: integer("verified_buyer", { mode: "boolean" }).notNull().default(false),
    verificationType: text("verification_type", { enum: ["DIGITAL_ORDER", "HISTORICAL_MATCH", "STAFF_MANUAL", "UNVERIFIED"] }).notNull().default("UNVERIFIED"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    featuredUntil: text("featured_until"),
    moderationReason: text("moderation_reason"),
    rejectionReason: text("rejection_reason", { enum: ["SPAM", "PROFANITY", "UNRELATED", "COMPETITOR", "OTHER"] }),
    moderatedBy: text("moderated_by"),
    moderatedAt: text("moderated_at"),
    sellerReplyText: text("seller_reply_text"),
    sellerRepliedAt: text("seller_replied_at"),
    sellerRepliedBy: text("seller_replied_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("reviews_shop_status_idx").on(table.shopId, table.status, table.createdAt), index("reviews_shop_featured_idx").on(table.shopId, table.featured, table.featuredUntil)],
);

export const shopPaymentMethods = sqliteTable(
  "shop_payment_methods",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    method: text("method", { enum: ["CASH", "BANK_TRANSFER", "MOBILEPAY", "CARD", "OTHER"] }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    instructionsFi: text("instructions_fi"),
    instructionsEn: text("instructions_en"),
    merchantDetailsJson: text("merchant_details_json"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("shop_payment_methods_unique").on(table.shopId, table.method)],
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    username: text("username"),
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
    sessionVersion: integer("session_version").notNull().default(1),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["ADMIN", "MANAGER", "STAFF", "CONTENT_CREATOR"] }).notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

// Better Auth tables are isolated from the shop RBAC users table during the
// migration period. They can be mapped to shop users after the provider is
// explicitly enabled and existing accounts have been reconciled.
export const authUsers = sqliteTable("auth_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => authUsers.id),
});

export const authAccounts = sqliteTable("auth_accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => authUsers.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const authVerifications = sqliteTable("auth_verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const userPermissions = sqliteTable(
  "user_permissions",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    userId: text("user_id").notNull().references(() => users.id),
    permission: text("permission").notNull(),
    granted: integer("granted", { mode: "boolean" }).notNull().default(true),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("user_permissions_user_code_unique").on(table.userId, table.permission)],
);

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
    showOnHomepage: integer("show_on_homepage", { mode: "boolean" }).notNull().default(true),
    showOnReserve: integer("show_on_reserve", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex("products_shop_code_unique").on(table.shopId, table.code),
    index("products_shop_sort_idx").on(table.shopId, table.active, table.sortOrder),
    check("products_valid_window", sql`${table.availableFrom} <= ${table.availableThrough}`),
  ],
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    url: text("url").notNull(),
    pathname: text("pathname").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    altFi: text("alt_fi").notNull(),
    altEn: text("alt_en").notNull(),
    captionFi: text("caption_fi").notNull().default(""),
    captionEn: text("caption_en").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("media_assets_shop_idx").on(table.shopId)],
);

export const mediaAttachments = sqliteTable(
  "media_attachments",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    assetId: text("asset_id").notNull().references(() => mediaAssets.id),
    productId: text("product_id").references(() => products.id),
    pageKey: text("page_key"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("media_attachments_product_idx").on(table.shopId, table.productId, table.sortOrder)],
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
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
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
    customerId: text("customer_id").references(() => customers.id),
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
    mobile: text("mobile"),
    email: text("email"),
    streetAddress: text("street_address"),
    postalCode: text("postal_code"),
    city: text("city"),
    pickupName: text("pickup_name"),
    pickupAddress: text("pickup_address"),
    pickupInstructions: text("pickup_instructions"),
    pickupTime: text("pickup_time"),
    pickupLocationSnapshotJson: text("pickup_location_snapshot_json"),
    deliveryOriginSnapshotJson: text("delivery_origin_snapshot_json"),
    notes: text("notes"),
    facebookProfile: text("facebook_profile"),
    orderSource: text("order_source").notNull().default("WEBSITE"),

    historicalEntry: integer("historical_entry", { mode: "boolean" }).notNull().default(false),
    statusReason: text("status_reason"),
    contactedAt: text("contacted_at"),
    contactedBy: text("contacted_by"),
    contactChannel: text("contact_channel"),
    fulfillmentStartedAt: text("fulfillment_started_at"),
    readyAt: text("ready_at"),
    dispatchedAt: text("dispatched_at"),
    completedAt: text("completed_at"),
    pickupConfirmedAt: text("pickup_confirmed_at"),
    pickupConfirmedBy: text("pickup_confirmed_by"),
    locale: text("locale", { enum: ["fi", "en"] }).notNull(),
    status: text("status", { enum: ["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "CUSTOMER_DECLINED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "REFUNDED"] }).notNull().default("NEW"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    archivedAt: text("archived_at"),
    archivedBy: text("archived_by"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("orders_shop_reference_unique").on(table.shopId, table.publicReference),
    uniqueIndex("orders_shop_idempotency_unique").on(table.shopId, table.idempotencyKey),
    index("orders_shop_created_idx").on(table.shopId, table.createdAt),
    index("orders_shop_archived_idx").on(table.shopId, table.archived),
    check("orders_positive_quantity", sql`${table.quantity} > 0`),
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
    kind: text("kind", { enum: ["PAYMENT", "REFUND"] }).notNull().default("PAYMENT"),
    method: text("method", { enum: ["CASH", "BANK_TRANSFER", "MOBILEPAY", "CARD", "OTHER"] }).notNull(),
    reference: text("reference"),
    recordedAt: text("recorded_at").notNull(),
    actor: text("actor").notNull(),
  },
  (table) => [
    index("order_payments_shop_order_idx").on(table.shopId, table.orderId, table.recordedAt),
    check("order_payments_positive_amount", sql`${table.amountCents} > 0`),
  ],
);

export const outboxJobs = sqliteTable(
  "outbox_jobs",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    eventKey: text("event_key").notNull(),
    type: text("type", { enum: ["EMAIL", "AUTOMATION", "NOTIFICATION"] }).notNull(),
    payloadJson: text("payload_json").notNull(),
    status: text("status", { enum: ["PENDING", "PROCESSING", "SENT", "FAILED"] }).notNull().default("PENDING"),
    scheduledFor: text("scheduled_for").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    processedAt: text("processed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("outbox_shop_event_unique").on(table.shopId, table.eventKey), index("outbox_due_idx").on(table.shopId, table.status, table.scheduledFor)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    eventKey: text("event_key").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    orderId: text("order_id"),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("notifications_shop_event_unique").on(table.shopId, table.eventKey), index("notifications_shop_read_idx").on(table.shopId, table.readAt, table.createdAt)],
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
