import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { shops } from "@/db/schema";
import { DomainError } from "./errors";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";

export type AdminSettingsUpdate = Partial<Pick<typeof shops.$inferInsert, "contactPhone" | "contactEmail" | "contactHours" | "nameFi" | "nameEn" | "businessName" | "businessId" | "howItWorksVisible" | "aboutUsVisible" | "reviewsVisible" | "active" | "sameDayCutoffEnabled" | "sameDayCutoffTime">>;
export async function getAdminSettings(database: Database, context: AdminActionContext) { assertAdminActionContext(context); const shop = await database.query.shops.findFirst({ where: eq(shops.id, context.shop.id) }); if (!shop) throw new DomainError("NOT_FOUND", "Shop not found", 404); return shop; }
export async function updateAdminSettings(database: Database, context: AdminActionContext, input: AdminSettingsUpdate) { assertAdminActionContext(context); const [shop] = await database.update(shops).set(input).where(eq(shops.id, context.shop.id)).returning(); if (!shop) throw new DomainError("NOT_FOUND", "Shop not found", 404); return shop; }
