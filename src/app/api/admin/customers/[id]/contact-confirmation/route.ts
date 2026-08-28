import { z } from "zod";
import { confirmAdminCustomerContact } from "@/domain/admin-customer-actions";
import { env } from "@/lib/env";
import { executeAdmin, parseJson } from "../../../module";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";

const inputSchema = z.object({
  channel: z.enum(["WHATSAPP", "SMS", "PHONE", "OTHER"]),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await executeAdmin(request, { permission: "customers.retention.manage", parse: async (incoming) => { const parsed = inputSchema.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid contact confirmation input", 422); return parsed.data; }, run: async (input, { database, context: { actor } }) => confirmAdminCustomerContact(database, { actor, shop: { id: env().SHOP_ID } }, id, input.channel, input.note) });
    return success(result);
  } catch (error) {
    return failure(error, request);
  }
}
