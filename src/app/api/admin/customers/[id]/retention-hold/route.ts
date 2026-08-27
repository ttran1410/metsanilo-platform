import { z } from "zod";
import { db } from "@/db/client";
import { clearCustomerRetentionHold, setCustomerRetentionHold } from "@/domain/customers";
import { requirePermission } from "@/domain/access";
import { failure, success } from "../../../../response";

const schema = z.object({ until: z.string().datetime(), reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor = await requirePermission(db(), request, "customers.retention.manage"); const parsed = schema.safeParse(await request.json()); if (!parsed.success) throw new Error("Invalid retention hold input"); const { id } = await context.params; await setCustomerRetentionHold(db(), id, actor.email ?? actor.username ?? actor.id, parsed.data.until, parsed.data.reason); return success({ held: true }); } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor = await requirePermission(db(), request, "customers.retention.manage"); const { id } = await context.params; await clearCustomerRetentionHold(db(), id, actor.email ?? actor.username ?? actor.id); return success({ held: false }); } catch (error) { return failure(error); }
}
