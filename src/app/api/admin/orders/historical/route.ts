import { z } from "zod";
import { createHistoricalOrder } from "@/domain/operations";
import { fromZodError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { executeAdmin, parseJson } from "../../module";

export const runtime = "nodejs";
const command = z.object({ productId: z.string(), packageId: z.string(), quantity: z.number().int().min(1).max(100), fulfillmentDate: z.string(), fulfillmentMethod: z.enum(["PICKUP", "DELIVERY"]), customerName: z.string(), mobile: z.string().optional(), email: z.string().optional(), facebookProfile: z.string().optional(), streetAddress: z.string().optional(), postalCode: z.string().optional(), city: z.string().optional(), itemSubtotalCents: z.number().int().nonnegative().optional(), deliveryFeeCents: z.number().int().nonnegative().optional(), completedStatus: z.enum(["PICKED_UP", "DELIVERED"]), completedAt: z.string(), source: z.enum(["PHONE", "SMS", "WHATSAPP", "FACEBOOK", "WEBSITE", "OTHER"]), reason: z.string().min(2), paymentAmountCents: z.number().int().positive().optional(), paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "MOBILEPAY", "CARD", "OTHER"]).optional() });


export async function POST(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "orders.create", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw fromZodError(parsed.error, "Invalid historical order payload"); return parsed.data; }, run: async (input, { database }) => createHistoricalOrder(database, input) });
    return success(result, 201);
  } catch (error) {
    return failure(error);
  }
}
