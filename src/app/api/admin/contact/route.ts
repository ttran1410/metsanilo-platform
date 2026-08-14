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
  phone: z.string().trim().max(40),
  email: z.string().trim().email().or(z.literal("")),
  hours: z.string().trim().max(120),
});

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "settings.operational");
    const shop = await db().query.shops.findFirst({ where: eq(shops.id, env().SHOP_ID) });
    return success({ phone: shop?.contactPhone ?? "", email: shop?.contactEmail ?? "", hours: shop?.contactHours ?? "" });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "settings.operational");
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid contact settings", 422);
    const [shop] = await db().update(shops).set({ contactPhone: parsed.data.phone, contactEmail: parsed.data.email, contactHours: parsed.data.hours }).where(eq(shops.id, env().SHOP_ID)).returning();
    if (!shop) throw new DomainError("NOT_FOUND", "Shop not found", 404);
    return success({ phone: shop.contactPhone, email: shop.contactEmail, hours: shop.contactHours, updatedBy: actor.email ?? actor.id });
  } catch (error) { return failure(error); }
}
