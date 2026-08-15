import { z } from "zod";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { createHistoricalOrder } from "@/domain/operations";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";

export const runtime = "nodejs";
const command = z.object({ productId: z.string(), packageId: z.string(), quantity: z.number().int().min(1).max(100), fulfillmentDate: z.string(), fulfillmentMethod: z.enum(["PICKUP", "DELIVERY"]), customerName: z.string(), mobile: z.string(), email: z.string().optional(), streetAddress: z.string().optional(), postalCode: z.string().optional(), city: z.string().optional(), itemSubtotalCents: z.number().int().nonnegative().optional(), deliveryFeeCents: z.number().int().nonnegative().optional(), completedStatus: z.enum(["PICKED_UP", "DELIVERED"]), completedAt: z.string(), source: z.enum(["PHONE", "SMS", "WHATSAPP", "FACEBOOK", "WEBSITE", "OTHER"]), reason: z.string().min(2), paymentAmountCents: z.number().int().positive().optional() });

export async function POST(request: Request) {
  try { await requirePermission(db(), request, "orders.create"); const parsed = command.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid historical order", 422); return success(await createHistoricalOrder(db(), parsed.data), 201); } catch (error) { return failure(error); }
}
