import { executeAdmin, parseJson } from "../../../module";
import { resolveAdminCustomerIdentity } from "@/domain/admin-customer-actions";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../../../response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await executeAdmin(request, { permission: "customers.identity.resolve", parse: async (incoming) => { const body = await parseJson<{ action?: "KEEP_SEPARATE" | "MERGE"; duplicateId?: string; reason?: string }>(incoming); const reason = body.reason?.trim(); if (!body.action || !reason) throw new DomainError("VALIDATION_ERROR", "A resolution and reason are required", 422); return { id, action: body.action, duplicateId: body.duplicateId, reason }; }, run: async (input, { database, context: { actor } }) => resolveAdminCustomerIdentity(database, { actor, shop: { id: env().SHOP_ID } }, input) });
    return success(result);
  } catch (error) { return failure(error); }
}
