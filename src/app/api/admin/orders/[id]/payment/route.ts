import { z } from "zod";
import { db } from "@/db/client";
import { recordPayment } from "@/domain/orders";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";
const command = z.object({ amountCents: z.number().int().positive(), method: z.enum(["CASH", "BANK_TRANSFER", "MOBILEPAY", "CARD", "OTHER"]), reference: z.preprocess((value) => value === null || value === "" ? undefined : value, z.string().max(200).optional()) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid payment", 422);
    const { id } = await params;
    await requirePermission(db(), request, "orders.payment.write");
    return success(await recordPayment(db(), { orderId: id, ...parsed.data }), 201);
  } catch (error) {
    return failure(error);
  }
}
