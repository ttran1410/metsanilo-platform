import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, availability, mediaAttachments, mediaAssets, orders, packages, products } from "@/db/schema";
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
};

type PackageInput = {
  labelFi: string;
  labelEn: string;
  volumeMl: number;
  priceCents: number;
  active: boolean;
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
  };
}

function validatePackage(input: PackageInput) {
  if (!Number.isSafeInteger(input.volumeMl) || input.volumeMl <= 0) throw new DomainError("VALIDATION_ERROR", "Package litres must be positive", 422, { volumeMl: "Must be positive" });
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents < 0) throw new DomainError("VALIDATION_ERROR", "Package price must be non-negative cents", 422, { priceCents: "Must be non-negative" });
  return {
    labelFi: cleanText(input.labelFi, "labelFi", 120), labelEn: cleanText(input.labelEn, "labelEn", 120),
    volumeMl: input.volumeMl, priceCents: input.priceCents, active: input.active,
  };
}

async function audit(database: Database, action: string, entityType: string, entityId: string, details: Record<string, unknown>) {
  await database.insert(auditEntries).values({ id: randomUUID(), shopId: env().SHOP_ID, actor: "manager", action, entityType, entityId, detailsJson: JSON.stringify(details), createdAt: new Date().toISOString() });
}

export async function listManagerProducts(database: Database) {
  const shopId = env().SHOP_ID;
  const rows = await database.select({ product: products, package: packages }).from(products)
    .leftJoin(packages, and(eq(packages.productId, products.id), eq(packages.shopId, products.shopId)))
    .where(eq(products.shopId, shopId)).orderBy(asc(products.nameFi), asc(packages.volumeMl));
  const grouped = new Map<string, { product: typeof products.$inferSelect; packages: Array<typeof packages.$inferSelect> }>();
  for (const row of rows) {
    let group = grouped.get(row.product.id);
    if (!group) { group = { product: row.product, packages: [] }; grouped.set(row.product.id, group); }
    if (row.package) group.packages.push(row.package);
  }
  const media = await database.select({ attachment: mediaAttachments, asset: mediaAssets }).from(mediaAttachments)
    .innerJoin(mediaAssets, eq(mediaAssets.id, mediaAttachments.assetId))
    .where(eq(mediaAttachments.shopId, shopId)).orderBy(asc(mediaAttachments.sortOrder));
  return [...grouped.values()].map((item) => ({ ...item, media: media.filter((row) => row.attachment.productId === item.product.id).map((row) => ({ ...row.asset, sortOrder: row.attachment.sortOrder, isPrimary: row.attachment.isPrimary })) }));
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
      await tx.insert(packages).values(packageValues.map((item) => ({ id: randomUUID(), shopId, productId: id, ...item })));
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
  try { await database.update(products).set(product).where(and(eq(products.id, id), eq(products.shopId, shopId))); }
  catch (error) { if (String(error).toLowerCase().includes("unique")) throw new DomainError("DUPLICATE_PRODUCT", "Product code or slug already exists", 409); throw error; }
  await audit(database, "product.updated", "product", id, { from: { code: current.code, slug: current.slug }, to: { code: product.code, slug: product.slug } });
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
  await database.insert(packages).values({ id, shopId, productId, ...item });
  await audit(database, "package.created", "package", id, { productId });
  return (await database.query.packages.findFirst({ where: eq(packages.id, id) }))!;
}

export async function updatePackage(database: Database, id: string, input: PackageInput) {
  const shopId = env().SHOP_ID; const item = validatePackage(input);
  const current = await database.query.packages.findFirst({ where: and(eq(packages.id, id), eq(packages.shopId, shopId)) });
  if (!current) throw new DomainError("NOT_FOUND", "Package not found", 404);
  await database.update(packages).set(item).where(and(eq(packages.id, id), eq(packages.shopId, shopId)));
  await audit(database, "package.updated", "package", id, { productId: current.productId });
  return (await database.query.packages.findFirst({ where: eq(packages.id, id) }))!;
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
