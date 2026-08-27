import { z } from "zod";
import { db } from "@/db/client";
import { confirmCustomerContact } from "@/domain/customers";
import { requirePermission } from "@/domain/access";
import { failure, success } from "../../../../response";

const inputSchema = z.object({
  channel: z.enum(["WHATSAPP", "SMS", "PHONE", "OTHER"]),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(db(), request, "customers.retention.manage");
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return failure(new Error("Invalid contact confirmation input"));
    const { id } = await context.params;
    const result = await confirmCustomerContact(db(), id, actor.email ?? actor.username ?? actor.id, parsed.data.channel, parsed.data.note);
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
