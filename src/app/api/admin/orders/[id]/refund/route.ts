import { z } from "zod";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { recordRefund } from "@/domain/orders";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";

export const runtime = "nodejs";
const command = z.object({ amountCents: z.number().int().positive(), method: z.enum(["CASH", "BANK_TRANSFER", "MOBILEPAY", "CARD", "OTHER"]), reason: z.string().min(2).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requirePermission(db(), request, "orders.payment.write"); const parsed = command.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid refund", 422); return success(await recordRefund(db(), { orderId: (await params).id, ...parsed.data }), 201); } catch (error) { return failure(error); }
}
