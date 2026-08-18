import { z } from "zod";
import { db } from "@/db/client";
import { hasUserPermission, requirePermission } from "@/domain/access";
import { createExternalOrder } from "@/domain/operations";
import { fromZodError } from "@/domain/errors";
import { failure, success } from "../../../response";

export const runtime = "nodejs";
const command = z.object({ productId: z.string(), packageId: z.string(), quantity: z.number().int().min(1).max(100), fulfillmentDate: z.string(), fulfillmentMethod: z.enum(["PICKUP", "DELIVERY"]), customerName: z.string(), mobile: z.string().optional(), email: z.string().optional(), facebookProfile: z.string().optional(), streetAddress: z.string().optional(), postalCode: z.string().optional(), city: z.string().optional(), notes: z.string().optional(), status: z.enum(["NEW", "CONFIRMED"]), source: z.enum(["PHONE", "SMS", "WHATSAPP", "FACEBOOK", "WEBSITE", "OTHER"]), deliveryFeeCents: z.number().int().nonnegative().optional() });


export async function POST(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "orders.create");
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw fromZodError(parsed.error, "Invalid external order payload");

    const allowDateOverride = await hasUserPermission(db(), actor, "orders.override_closed_date");

    return success(await createExternalOrder(db(), { ...parsed.data, allowDateOverride }), 201);
  } catch (error) {
    return failure(error);
  }
}
