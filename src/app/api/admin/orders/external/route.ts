import { z } from "zod";
import { hasUserPermission } from "@/domain/access";
import { createExternalOrder } from "@/domain/operations";
import { fromZodError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { executeAdmin, parseJson } from "../../module";

export const runtime = "nodejs";
const command = z.object({ productId: z.string(), packageId: z.string(), quantity: z.number().int().min(1).max(100), fulfillmentDate: z.string(), fulfillmentMethod: z.enum(["PICKUP", "DELIVERY"]), customerName: z.string(), mobile: z.string().optional(), email: z.string().optional(), facebookProfile: z.string().optional(), streetAddress: z.string().optional(), postalCode: z.string().optional(), city: z.string().optional(), notes: z.string().optional(), status: z.enum(["NEW", "CONFIRMED"]), source: z.enum(["PHONE", "SMS", "WHATSAPP", "FACEBOOK", "WEBSITE", "OTHER"]), deliveryFeeCents: z.number().int().nonnegative().optional() });


export async function POST(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "orders.create", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw fromZodError(parsed.error, "Invalid external order payload"); return parsed.data; }, run: async (input, { database, context: { actor } }) => { const allowDateOverride = await hasUserPermission(database, actor, "orders.override_closed_date"); return createExternalOrder(database, { ...input, allowDateOverride }); } });
    return success(result, 201);
  } catch (error) {
    return failure(error);
  }
}
