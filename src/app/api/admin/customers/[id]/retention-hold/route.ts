import { z } from "zod";
import { db } from "@/db/client";
import { clearAdminCustomerRetentionHold, setAdminCustomerRetentionHold } from "@/domain/admin-customer-actions";
import { env } from "@/lib/env";
import { authenticateAdmin, parseJson } from "../../../module";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";

const schema = z.object({ until: z.string().datetime(), reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor = (await authenticateAdmin(request, "customers.retention.manage")).actor; const parsed = schema.safeParse(await parseJson<unknown>(request)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid retention hold input", 422); const { id } = await context.params; await setAdminCustomerRetentionHold(db(), { actor, shop: { id: env().SHOP_ID } }, id, parsed.data.until, parsed.data.reason); return success({ held: true }); } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor = (await authenticateAdmin(request, "customers.retention.manage")).actor; const { id } = await context.params; await clearAdminCustomerRetentionHold(db(), { actor, shop: { id: env().SHOP_ID } }, id); return success({ held: false }); } catch (error) { return failure(error); }
}
