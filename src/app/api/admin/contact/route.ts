import { z } from "zod";
import { shops } from "@/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "@/domain/errors";
import { getAdminSettings, updateAdminSettings } from "@/domain/admin-settings-actions";
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
    const result = await executeAdmin(request, { permission: "settings.read", parse: async () => undefined, run: async (_input, { database, context }) => response(await getAdminSettings(database, { actor: context.actor, shop: { id: env().SHOP_ID } })) });
    return success(result);
  } catch (error) { return failure(error, request); }
}

export async function PUT(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "settings.operational", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid settings input", 422); return parsed.data; }, run: async (input, { database, context }) => response(await updateAdminSettings(database, { actor: context.actor, shop: { id: env().SHOP_ID } }, { contactPhone: input.phone, contactEmail: input.email, contactHours: input.hours, nameFi: input.nameFi, nameEn: input.nameEn, businessName: input.businessName, businessId: input.businessId, howItWorksVisible: input.howItWorksVisible, aboutUsVisible: input.aboutUsVisible, reviewsVisible: input.reviewsVisible, active: input.active, sameDayCutoffEnabled: input.sameDayCutoffEnabled, sameDayCutoffTime: input.sameDayCutoffTime })) });
    return success(result);
  } catch (error) { return failure(error, request); }
}
