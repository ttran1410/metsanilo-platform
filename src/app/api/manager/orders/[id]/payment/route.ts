import { z } from "zod";
import { db } from "@/db/client";
import { recordPayment } from "@/domain/orders";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";

export const runtime = "nodejs";
const command = z.object({ amountCents: z.number().int().positive(), method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]), reference: z.string().max(200).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid payment", 422);
    const { id } = await params;
    return success(await recordPayment(db(), { orderId: id, ...parsed.data }), 201);
  } catch (error) {
    return failure(error);
  }
}
