import { eq } from "drizzle-orm";
import { z } from "zod";
import { shops } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "@/domain/errors";
import { executeAdmin, parseJson } from "@/app/api/admin/module";
import { failure, success } from "../../response";

export const runtime = "nodejs";

const command = z.object({
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().or(z.literal("")).optional(),
  hours: z.string().trim().max(120).optional(),
  nameFi: z.string().trim().min(1).max(100).optional(),
  nameEn: z.string().trim().min(1).max(100).optional(),
  businessName: z.string().trim().max(100).optional(),
  businessId: z.string().trim().max(40).optional(),
  howItWorksVisible: z.boolean().optional(),
  aboutUsVisible: z.boolean().optional(),
  reviewsVisible: z.boolean().optional(),
  active: z.boolean().optional(),
  sameDayCutoffEnabled: z.boolean().optional(),
  sameDayCutoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});

function response(shop: typeof shops.$inferSelect, updatedBy?: string) {
  return { phone: shop.contactPhone ?? "", email: shop.contactEmail ?? "", hours: shop.contactHours ?? "", nameFi: shop.nameFi ?? "", nameEn: shop.nameEn ?? "", businessName: shop.businessName ?? "", businessId: shop.businessId ?? "", howItWorksVisible: shop.howItWorksVisible ?? true, aboutUsVisible: shop.aboutUsVisible ?? true, reviewsVisible: shop.reviewsVisible ?? true, active: shop.active ?? true, sameDayCutoffEnabled: shop.sameDayCutoffEnabled ?? false, sameDayCutoffTime: shop.sameDayCutoffTime ?? "15:00", ...(updatedBy ? { updatedBy } : {}) };
}

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "settings.read", parse: async () => undefined, run: async (_input, { database }) => { const shop = await database.query.shops.findFirst({ where: eq(shops.id, env().SHOP_ID) }); if (!shop) throw new DomainError("NOT_FOUND", "Shop not found", 404); return response(shop); } });
    return success(result);
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "settings.operational", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid settings input", 422); return parsed.data; }, run: async (input, { database, context }) => { const updateData: Partial<typeof shops.$inferInsert> = {}; if (input.phone !== undefined) updateData.contactPhone = input.phone; if (input.email !== undefined) updateData.contactEmail = input.email; if (input.hours !== undefined) updateData.contactHours = input.hours; if (input.nameFi !== undefined) updateData.nameFi = input.nameFi; if (input.nameEn !== undefined) updateData.nameEn = input.nameEn; if (input.businessName !== undefined) updateData.businessName = input.businessName; if (input.businessId !== undefined) updateData.businessId = input.businessId; if (input.howItWorksVisible !== undefined) updateData.howItWorksVisible = input.howItWorksVisible; if (input.aboutUsVisible !== undefined) updateData.aboutUsVisible = input.aboutUsVisible; if (input.reviewsVisible !== undefined) updateData.reviewsVisible = input.reviewsVisible; if (input.active !== undefined) updateData.active = input.active; if (input.sameDayCutoffEnabled !== undefined) updateData.sameDayCutoffEnabled = input.sameDayCutoffEnabled; if (input.sameDayCutoffTime !== undefined) updateData.sameDayCutoffTime = input.sameDayCutoffTime; const [shop] = await database.update(shops).set(updateData).where(eq(shops.id, env().SHOP_ID)).returning(); if (!shop) throw new DomainError("NOT_FOUND", "Shop not found", 404); return response(shop, context.actor.email ?? context.actor.id); } });
    return success(result);
  } catch (error) { return failure(error); }
}
