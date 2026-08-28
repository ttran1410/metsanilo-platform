import { z } from "zod";
import { clearAdminCustomerRetentionHold, setAdminCustomerRetentionHold } from "@/domain/admin-customer-actions";
import { env } from "@/lib/env";
import { executeAdmin, parseJson } from "../../../module";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";

const schema = z.object({ until: z.string().datetime(), reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; const result = await executeAdmin(request, { permission: "customers.retention.manage", parse: async (incoming) => { const parsed = schema.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid retention hold input", 422); return parsed.data; }, run: async (input, { database, context: { actor } }) => { await setAdminCustomerRetentionHold(database, { actor, shop: { id: env().SHOP_ID } }, id, input.until, input.reason); return { held: true }; } }); return success(result); } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; const result = await executeAdmin(request, { permission: "customers.retention.manage", parse: async () => id, run: async (customerId, { database, context: { actor } }) => { await clearAdminCustomerRetentionHold(database, { actor, shop: { id: env().SHOP_ID } }, customerId); return { held: false }; } }); return success(result); } catch (error) { return failure(error); }
}
