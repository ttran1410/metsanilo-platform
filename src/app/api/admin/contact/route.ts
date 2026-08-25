import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { shops } from "@/db/schema";
import { requirePermission } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
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

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "settings.read");
    const shop = await db().query.shops.findFirst({ where: eq(shops.id, env().SHOP_ID) });
    return success({
      phone: shop?.contactPhone ?? "",
      email: shop?.contactEmail ?? "",
      hours: shop?.contactHours ?? "",
      nameFi: shop?.nameFi ?? "",
      nameEn: shop?.nameEn ?? "",
      businessName: shop?.businessName ?? "",
      businessId: shop?.businessId ?? "",
      howItWorksVisible: shop?.howItWorksVisible ?? true,
      aboutUsVisible: shop?.aboutUsVisible ?? true,
      reviewsVisible: shop?.reviewsVisible ?? true,
      active: shop?.active ?? true,
      sameDayCutoffEnabled: shop?.sameDayCutoffEnabled ?? false,
      sameDayCutoffTime: shop?.sameDayCutoffTime ?? "15:00",
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "settings.operational");
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid settings input", 422);

    const updateData: Partial<typeof shops.$inferInsert> = {};
    if (parsed.data.phone !== undefined) updateData.contactPhone = parsed.data.phone;
    if (parsed.data.email !== undefined) updateData.contactEmail = parsed.data.email;
    if (parsed.data.hours !== undefined) updateData.contactHours = parsed.data.hours;
    if (parsed.data.nameFi !== undefined) updateData.nameFi = parsed.data.nameFi;
    if (parsed.data.nameEn !== undefined) updateData.nameEn = parsed.data.nameEn;
    if (parsed.data.businessName !== undefined) updateData.businessName = parsed.data.businessName;
    if (parsed.data.businessId !== undefined) updateData.businessId = parsed.data.businessId;
    if (parsed.data.howItWorksVisible !== undefined) updateData.howItWorksVisible = parsed.data.howItWorksVisible;
    if (parsed.data.aboutUsVisible !== undefined) updateData.aboutUsVisible = parsed.data.aboutUsVisible;
    if (parsed.data.reviewsVisible !== undefined) updateData.reviewsVisible = parsed.data.reviewsVisible;
    if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
    if (parsed.data.sameDayCutoffEnabled !== undefined) updateData.sameDayCutoffEnabled = parsed.data.sameDayCutoffEnabled;
    if (parsed.data.sameDayCutoffTime !== undefined) updateData.sameDayCutoffTime = parsed.data.sameDayCutoffTime;

    const [shop] = await db().update(shops).set(updateData).where(eq(shops.id, env().SHOP_ID)).returning();
    if (!shop) throw new DomainError("NOT_FOUND", "Shop not found", 404);

    return success({
      phone: shop.contactPhone,
      email: shop.contactEmail,
      hours: shop.contactHours,
      nameFi: shop.nameFi,
      nameEn: shop.nameEn,
      businessName: shop.businessName ?? "",
      businessId: shop.businessId ?? "",
      howItWorksVisible: shop.howItWorksVisible,
      aboutUsVisible: shop.aboutUsVisible,
      reviewsVisible: shop.reviewsVisible,
      active: shop.active,
      sameDayCutoffEnabled: shop.sameDayCutoffEnabled,
      sameDayCutoffTime: shop.sameDayCutoffTime,
      updatedBy: actor.email ?? actor.id,
    });
  } catch (error) {
    return failure(error);
  }
}
