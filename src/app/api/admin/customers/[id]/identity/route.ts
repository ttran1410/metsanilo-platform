import { db } from "@/db/client";
import { authenticateAdmin, parseJson } from "../../../module";
import { resolveAdminCustomerIdentity } from "@/domain/admin-customer-actions";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import { failure, success } from "../../../../response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = (await authenticateAdmin(request, "customers.identity.resolve")).actor;
    const { id } = await context.params;
    const body = await parseJson<{ action?: "KEEP_SEPARATE" | "MERGE"; duplicateId?: string; reason?: string }>(request);
    const reason = body.reason?.trim();
    if (!body.action || !reason) throw new DomainError("VALIDATION_ERROR", "A resolution and reason are required", 422);
    return success(await resolveAdminCustomerIdentity(db(), { actor, shop: { id: env().SHOP_ID } }, { id, action: body.action!, duplicateId: body.duplicateId, reason }));
  } catch (error) { return failure(error); }
}
