import { z } from "zod";
import { db } from "@/db/client";
import { confirmAdminCustomerContact } from "@/domain/admin-customer-actions";
import { env } from "@/lib/env";
import { authenticateAdmin, parseJson } from "../../../module";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";

const inputSchema = z.object({
  channel: z.enum(["WHATSAPP", "SMS", "PHONE", "OTHER"]),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = (await authenticateAdmin(request, "customers.retention.manage")).actor;
    const parsed = inputSchema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid contact confirmation input", 422);
    const { id } = await context.params;
    const result = await confirmAdminCustomerContact(db(), { actor, shop: { id: env().SHOP_ID } }, id, parsed.data.channel, parsed.data.note);
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
