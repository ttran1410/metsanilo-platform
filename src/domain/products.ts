import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, lt, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, availability, harvestSeasons, mediaAttachments, mediaAssets, orders, packages, products } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "./errors";

const codePattern = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type ProductInput = {
  code: string;
  slug: string;
  nameFi: string;
  nameEn: string;
  descriptionFi: string;
  descriptionEn: string;
  availableFrom: string;
  availableThrough: string;
  active: boolean;
  showOnHomepage?: boolean;
  showOnReserve?: boolean;
};

type PackageInput = {
  labelFi: string;
  labelEn: string;
  volumeMl: number;
  priceCents: number;
  active: boolean;
  sortOrder?: number;
  isDefault?: boolean;
};

function cleanText(value: string, field: string, max: number, required = true) {
  const clean = value.trim();
  if (required && !clean) throw new DomainError("VALIDATION_ERROR", `${field} is required`, 422, { [field]: "Required" });
  if (clean.length > max) throw new DomainError("VALIDATION_ERROR", `${field} is too long`, 422, { [field]: `Maximum ${max} characters` });
  return clean;
}

function validateProduct(input: ProductInput) {
  const code = input.code.trim().toUpperCase();
  const slug = input.slug.trim().toLowerCase();
  if (!codePattern.test(code)) throw new DomainError("VALIDATION_ERROR", "Code must be 2–40 uppercase letters, numbers, hyphens, or underscores", 422, { code: "Invalid code" });
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) throw new DomainError("VALIDATION_ERROR", "Slug must use lowercase letters, numbers, and hyphens", 422, { slug: "Invalid slug" });
  if (!datePattern.test(input.availableFrom) || !datePattern.test(input.availableThrough) || input.availableFrom > input.availableThrough) {
    throw new DomainError("VALIDATION_ERROR", "Availability dates are invalid", 422, { availableFrom: "Invalid date window" });
  }
  return {
    code, slug,
    nameFi: cleanText(input.nameFi, "nameFi", 120), nameEn: cleanText(input.nameEn, "nameEn", 120),
    descriptionFi: cleanText(input.descriptionFi, "descriptionFi", 5000, false), descriptionEn: cleanText(input.descriptionEn, "descriptionEn", 5000, false),
    availableFrom: input.availableFrom, availableThrough: input.availableThrough, active: input.active,
    showOnHomepage: input.showOnHomepage ?? true, showOnReserve: input.showOnReserve ?? true,
  };
}

function validatePackage(input: PackageInput) {
  if (!Number.isSafeInteger(input.volumeMl) || input.volumeMl <= 0) throw new DomainError("VALIDATION_ERROR", "Package litres must be positive", 422, { volumeMl: "Must be positive" });
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents < 0) throw new DomainError("VALIDATION_ERROR", "Package price must be non-negative cents", 422, { priceCents: "Must be non-negative" });
  return {
    labelFi: cleanText(input.labelFi, "labelFi", 120), labelEn: cleanText(input.labelEn, "labelEn", 120),
    volumeMl: input.volumeMl, priceCents: input.priceCents, active: input.active,
    sortOrder: input.sortOrder ?? 0, isDefault: input.isDefault ?? false,
  };
}

async function audit(database: Database, action: string, entityType: string, entityId: string, details: Record<string, unknown>) {
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: env().SHOP_ID, actor: "manager", action, entityType, entityId, detailsJson: JSON.stringify(details), createdAt: new Date().toISOString() });
}

export async function listManagerProducts(database: Database, productIds?: string[]) {
  const shopId = env().SHOP_ID;
  const rows = await database.select({ product: products, package: packages }).from(products)
    .leftJoin(packages, and(eq(packages.productId, products.id), eq(packages.shopId, products.shopId)))
    .where(and(eq(products.shopId, shopId), productIds?.length ? inArray(products.id, productIds) : undefined)).orderBy(asc(products.sortOrder), asc(products.nameFi), asc(packages.sortOrder), asc(packages.volumeMl));
  const grouped = new Map<string, { product: typeof products.$inferSelect; packages: Array<typeof packages.$inferSelect> }>();
  for (const row of rows) {
    let group = grouped.get(row.product.id);
    if (!group) { group = { product: row.product, packages: [] }; grouped.set(row.product.id, group); }
    if (row.package) group.packages.push(row.package);
  }
  const media = await database.select({ attachment: mediaAttachments, asset: mediaAssets }).from(mediaAttachments)
    .innerJoin(mediaAssets, eq(mediaAssets.id, mediaAttachments.assetId))
    .where(and(eq(mediaAttachments.shopId, shopId), productIds?.length ? inArray(mediaAttachments.productId, productIds) : undefined)).orderBy(asc(mediaAttachments.sortOrder));
  return [...grouped.values()].map((item) => ({ ...item, packages: [...item.packages].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder || b.volumeMl - a.volumeMl), media: media.filter((row) => row.attachment.productId === item.product.id).map((row) => ({ ...row.asset, attachmentId: row.attachment.id, sortOrder: row.attachment.sortOrder, isPrimary: row.attachment.isPrimary })) }));
}

export async function getProductReadiness(database: Database, productId: string) {
  const shopId = env().SHOP_ID;
  const product = await database.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.shopId, shopId)) });
  if (!product) throw new DomainError("NOT_FOUND", "Product not found", 404);

  const [packageRows, seasonRows, availabilityRows] = await Promise.all([
    database.select().from(packages).where(and(eq(packages.productId, productId), eq(packages.shopId, shopId))),
    database.select({ id: harvestSeasons.id }).from(harvestSeasons).where(and(eq(harvestSeasons.productId, productId), eq(harvestSeasons.shopId, shopId))),
    database.select({ id: availability.id }).from(availability).where(and(eq(availability.productId, productId), eq(availability.shopId, shopId))),
  ]);

  const checks = {
    active: product.active,
    bilingualName: Boolean(product.nameFi.trim() && product.nameEn.trim()),
    activePackage: packageRows.some((item) => item.active),
    defaultPackage: packageRows.some((item) => item.active && item.isDefault),
    harvestSeason: seasonRows.length > 0,
    availability: availabilityRows.length > 0,
  };
  const blockers = Object.entries(checks).filter(([, passed]) => !passed).map(([key]) => key);

  return {
    productId,
    ready: blockers.length === 0,
    checks,
    blockers,
    pricing: {
      model: "PACKAGE_CATALOG" as const,
      seasonAware: false,
      decision: "Package prices are global; season-specific pricing requires an explicit future pricing model.",
    },
  };
}

export async function createProduct(database: Database, input: ProductInput & { packages: PackageInput[] }) {
  const shopId = env().SHOP_ID;
  const product = validateProduct(input);
  if (!input.packages.length) throw new DomainError("VALIDATION_ERROR", "At least one package is required", 422);
  const packageValues = input.packages.map(validatePackage);
  const id = randomUUID();
  await database.transaction(async (tx) => {
    try {
      await tx.insert(products).values({ id, shopId, ...product });
      const explicitDefaultIndex = packageValues.findIndex((item) => item.isDefault);
      const fallbackIndex = explicitDefaultIndex >= 0 ? explicitDefaultIndex : Math.max(0, packageValues.findIndex((item) => item.volumeMl === 10000) >= 0 ? packageValues.findIndex((item) => item.volumeMl === 10000) : packageValues.reduce((best, item, index, all) => item.volumeMl > all[best].volumeMl ? index : best, 0));
      await tx.insert(packages).values(packageValues.map((item, index) => ({ id: randomUUID(), shopId, productId: id, ...item, sortOrder: index, isDefault: index === fallbackIndex })));
    } catch (error) {
      const databaseError = error as { cause?: { message?: string; cause?: { message?: string } } };
      const message = `${String(error)} ${databaseError.cause?.message ?? ""} ${databaseError.cause?.cause?.message ?? ""}`.toLowerCase();
      if (message.includes("unique") || message.includes("constraint")) throw new DomainError("DUPLICATE_PRODUCT", "Product code or slug already exists", 409);
      throw error;
    }
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId, actor: "manager", action: "product.created", entityType: "product", entityId: id, detailsJson: JSON.stringify({ code: product.code }), createdAt: new Date().toISOString() });
  });
  return (await listManagerProducts(database)).find((item) => item.product.id === id)!;
}

export async function updateProduct(database: Database, id: string, input: ProductInput) {
  const shopId = env().SHOP_ID;
  const product = validateProduct(input);
  const current = await database.query.products.findFirst({ where: and(eq(products.id, id), eq(products.shopId, shopId)) });
  if (!current) throw new DomainError("NOT_FOUND", "Product not found", 404);
  const activeOrders = await database.select({ id: orders.id, fulfillmentDate: orders.fulfillmentDate }).from(orders).where(and(eq(orders.productId, id), eq(orders.shopId, shopId), inArray(orders.status, ["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY"])));
  const conflictingOrder = activeOrders.find((order) => order.fulfillmentDate < product.availableFrom || order.fulfillmentDate > product.availableThrough);
  if (conflictingOrder) throw new DomainError("PRODUCT_WINDOW_CONFLICT", "Availability window would exclude an active order", 409, { orderId: conflictingOrder.id });
  const conflictingAvailability = await database.select({ id: availability.id, reservedMl: availability.reservedMl }).from(availability).where(and(eq(availability.productId, id), eq(availability.shopId, shopId), or(lt(availability.businessDate, product.availableFrom), gt(availability.businessDate, product.availableThrough)), gt(availability.reservedMl, 0))).limit(1);
  if (conflictingAvailability.length) throw new DomainError("PRODUCT_WINDOW_CONFLICT", "Availability window would exclude reserved harvest capacity", 409, { availabilityId: conflictingAvailability[0].id });
  try { await database.update(products).set(product).where(and(eq(products.id, id), eq(products.shopId, shopId))); }
  catch (error) { if (String(error).toLowerCase().includes("unique")) throw new DomainError("DUPLICATE_PRODUCT", "Product code or slug already exists", 409); throw error; }
  await database.update(availability).set({ acceptsOrders: false, manualSoldOut: true, manualSoldOutReason: "Outside product availability window" }).where(and(eq(availability.productId, id), eq(availability.shopId, shopId), or(lt(availability.businessDate, product.availableFrom), gt(availability.businessDate, product.availableThrough))));
  await audit(database, "product.updated", "product", id, { changedFields: Object.keys(product).filter((field) => current[field as keyof typeof current] !== product[field as keyof typeof product]), from: { code: current.code, slug: current.slug, availableFrom: current.availableFrom, availableThrough: current.availableThrough, showOnHomepage: current.showOnHomepage, showOnReserve: current.showOnReserve }, to: { code: product.code, slug: product.slug, availableFrom: product.availableFrom, availableThrough: product.availableThrough, showOnHomepage: product.showOnHomepage, showOnReserve: product.showOnReserve }, impact: { activeOrdersChecked: activeOrders.length, reservedAvailabilityChecked: conflictingAvailability.length } });
  return (await listManagerProducts(database)).find((item) => item.product.id === id)!;
}

export async function setProductActive(database: Database, id: string, active: boolean) {
  const shopId = env().SHOP_ID;
  const result = await database.update(products).set({ active }).where(and(eq(products.id, id), eq(products.shopId, shopId))).run();
  if (result.rowsAffected !== 1) throw new DomainError("NOT_FOUND", "Product not found", 404);
  await audit(database, active ? "product.activated" : "product.archived", "product", id, { active });
  return (await listManagerProducts(database)).find((item) => item.product.id === id)!;
}

export async function deleteProduct(database: Database, id: string) {
  const shopId = env().SHOP_ID;
  await database.transaction(async (tx) => {
    const referenced = await tx.select({ id: availability.id }).from(availability).where(and(eq(availability.productId, id), eq(availability.shopId, shopId))).limit(1);
    const ordered = await tx.select({ id: orders.id }).from(orders).where(and(eq(orders.productId, id), eq(orders.shopId, shopId))).limit(1);
    if (referenced.length || ordered.length) throw new DomainError("PRODUCT_IN_USE", "Product is referenced and can only be archived", 409);
    await tx.delete(packages).where(and(eq(packages.productId, id), eq(packages.shopId, shopId)));
    const result = await tx.delete(products).where(and(eq(products.id, id), eq(products.shopId, shopId))).run();
    if (result.rowsAffected !== 1) throw new DomainError("NOT_FOUND", "Product not found", 404);
    await tx.insert(auditEntries).values({ id: randomUUID(), shopId, actor: "manager", action: "product.deleted", entityType: "product", entityId: id, detailsJson: "{}", createdAt: new Date().toISOString() });
  });
  return { id, deleted: true };
}

export async function createPackage(database: Database, productId: string, input: PackageInput) {
  const shopId = env().SHOP_ID;
  const product = await database.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.shopId, shopId)) });
  if (!product) throw new DomainError("NOT_FOUND", "Product not found", 404);
  const item = validatePackage(input); const id = randomUUID();
  const existing = await database.select({ id: packages.id, volumeMl: packages.volumeMl, isDefault: packages.isDefault }).from(packages).where(and(eq(packages.productId, productId), eq(packages.shopId, shopId)));
  const makeDefault = item.isDefault === true || (!existing.some((row) => row.isDefault) && (item.volumeMl === 10000 || item.volumeMl >= Math.max(0, ...existing.map((row) => row.volumeMl))));
  await database.transaction(async (tx) => {
    if (makeDefault) await tx.update(packages).set({ isDefault: false }).where(and(eq(packages.productId, productId), eq(packages.shopId, shopId)));
    await tx.insert(packages).values({ id, shopId, productId, ...item, isDefault: makeDefault, sortOrder: existing.length });
  });
  await audit(database, "package.created", "package", id, { productId });
  return (await database.query.packages.findFirst({ where: eq(packages.id, id) }))!;
}

export async function updatePackage(database: Database, id: string, input: PackageInput) {
  const shopId = env().SHOP_ID; const item = validatePackage(input);
  const current = await database.query.packages.findFirst({ where: and(eq(packages.id, id), eq(packages.shopId, shopId)) });
  if (!current) throw new DomainError("NOT_FOUND", "Package not found", 404);
  if (current.isDefault && !item.active) throw new DomainError("DEFAULT_PACKAGE_REQUIRED", "Choose another default package before deactivating this package", 409);
  await database.update(packages).set({ ...item, isDefault: current.isDefault }).where(and(eq(packages.id, id), eq(packages.shopId, shopId)));
  await audit(database, "package.updated", "package", id, { productId: current.productId, changedFields: { labelFi: [current.labelFi, item.labelFi], labelEn: [current.labelEn, item.labelEn], volumeMl: [current.volumeMl, item.volumeMl], priceCents: [current.priceCents, item.priceCents], active: [current.active, item.active] }, priceImpact: current.priceCents !== item.priceCents ? "Existing orders retain their agreed price; future reservations use the new catalog price." : null });
  return (await database.query.packages.findFirst({ where: eq(packages.id, id) }))!;
}

export async function setDefaultPackage(database: Database, id: string) {
  const shopId = env().SHOP_ID;
  const current = await database.query.packages.findFirst({ where: and(eq(packages.id, id), eq(packages.shopId, shopId)) });
  if (!current) throw new DomainError("NOT_FOUND", "Package not found", 404);
  if (!current.active) throw new DomainError("DEFAULT_PACKAGE_REQUIRED", "Only active packages can be default", 409);
  await database.transaction(async (tx) => {
    await tx.update(packages).set({ isDefault: false }).where(and(eq(packages.productId, current.productId), eq(packages.shopId, shopId)));
    await tx.update(packages).set({ isDefault: true }).where(and(eq(packages.id, id), eq(packages.shopId, shopId)));
  });
  await audit(database, "package.default_changed", "package", id, { productId: current.productId });
  return (await database.query.packages.findFirst({ where: eq(packages.id, id) }))!;
}

export async function reorderProducts(database: Database, productIds: string[]) {
  const shopId = env().SHOP_ID;
  const existing = await database.select({ id: products.id }).from(products).where(eq(products.shopId, shopId));
  if (existing.length !== productIds.length || existing.some((row) => !productIds.includes(row.id))) {
    throw new DomainError("VALIDATION_ERROR", "Product reorder must include every product", 422);
  }
  await database.transaction(async (tx) => {
    for (const [index, productId] of productIds.entries()) {
      await tx.update(products).set({ sortOrder: index }).where(and(eq(products.id, productId), eq(products.shopId, shopId)));
    }
  });
  await audit(database, "product.reordered", "shop", shopId, { productIds });
  return listManagerProducts(database);
}

export async function reorderPackages(database: Database, productId: string, packageIds: string[]) {
  const shopId = env().SHOP_ID;
  const existing = await database.select({ id: packages.id }).from(packages).where(and(eq(packages.productId, productId), eq(packages.shopId, shopId)));
  if (existing.length !== packageIds.length || existing.some((row) => !packageIds.includes(row.id))) throw new DomainError("VALIDATION_ERROR", "Package order must include every package for this product", 422);
  await database.transaction(async (tx) => { for (const [index, packageId] of packageIds.entries()) await tx.update(packages).set({ sortOrder: index }).where(and(eq(packages.id, packageId), eq(packages.shopId, shopId), eq(packages.productId, productId))); });
  await audit(database, "package.reordered", "product", productId, { packageIds });
  return listManagerProducts(database);
}

export async function deletePackage(database: Database, id: string) {
  const shopId = env().SHOP_ID;
  const ordered = await database.select({ id: orders.id }).from(orders).where(and(eq(orders.packageId, id), eq(orders.shopId, shopId))).limit(1);
  if (ordered.length) throw new DomainError("PACKAGE_IN_USE", "Package is referenced and can only be archived", 409);
  const result = await database.delete(packages).where(and(eq(packages.id, id), eq(packages.shopId, shopId))).run();
  if (result.rowsAffected !== 1) throw new DomainError("NOT_FOUND", "Package not found", 404);
  await audit(database, "package.deleted", "package", id, {});
  return { id, deleted: true };
}
