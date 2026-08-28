import { z } from "zod";
import { db } from "@/db/client";
import { updateAdminOrderPricing } from "@/domain/admin-order-actions";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../../../response";
import { authenticateAdmin, parseJson } from "../../../module";


export const dynamic = "force-dynamic";
export const revalidate = 0;


const command = z.object({ expectedVersion: z.number().int().positive(), itemSubtotalCents: z.number().int().nonnegative(), deliveryFeeCents: z.number().int().nonnegative().nullable().optional(), reason: z.string().trim().min(2).max(500) });
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid order pricing", 422);
    const { id } = await params;
    const actor = (await authenticateAdmin(request, "orders.update")).actor;
    return success(await updateAdminOrderPricing(db(), { actor, shop: { id: env().SHOP_ID } }, { orderId: id, ...parsed.data }));
  } catch (error) { return failure(error); }
}
