import { z } from "zod";
import { confirmAdminCustomerContact } from "@/domain/admin-customer-actions";
import { executeAdminRoute, parseJson } from "../../../module";
import { DomainError } from "@/domain/errors";

const inputSchema = z.object({
  channel: z.enum(["WHATSAPP", "SMS", "PHONE", "OTHER"]),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "customers.retention.manage",
    parse: async (incoming) => {
      const parsed = inputSchema.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid contact confirmation input", 422);
      return parsed.data;
    },
    run: async (input, { database, context: { actor, shop } }) => {
      const { id } = await context.params;
      return confirmAdminCustomerContact(database, { actor, shop: { id: shop.shopId } }, id, input.channel, input.note);
    },
  });
}

