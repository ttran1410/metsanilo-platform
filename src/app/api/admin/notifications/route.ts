import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { notifications } from "@/db/schema";
import { env } from "@/lib/env";
import { failure, success } from "../../response";

export const runtime = "nodejs";
export async function GET(request: Request) { try { await requirePermission(db(), request, "orders.read"); return success(await db().select().from(notifications).where(and(eq(notifications.shopId, env().SHOP_ID), isNull(notifications.readAt))).orderBy(desc(notifications.createdAt))); } catch (error) { return failure(error); } }

export async function POST(request: Request) {
  try {
    await requirePermission(db(), request, "orders.update");
    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();
    const shopId = env().SHOP_ID;
    if (body.id) {
      await db().update(notifications).set({ readAt: now }).where(and(eq(notifications.shopId, shopId), eq(notifications.id, body.id)));
    } else {
      await db().update(notifications).set({ readAt: now }).where(and(eq(notifications.shopId, shopId), isNull(notifications.readAt)));
    }
    return success({ success: true });
  } catch (error) {
    return failure(error);
  }
}
