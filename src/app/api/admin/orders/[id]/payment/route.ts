import { z } from "zod";
import { recordPayment } from "@/domain/orders";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ amountCents: z.number().int().positive(), method: z.enum(["CASH", "BANK_TRANSFER", "MOBILEPAY", "CARD", "OTHER"]), reference: z.preprocess((value) => value === null || value === "" ? undefined : value, z.string().max(200).optional()) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await executeAdmin(request, {
      permission: "orders.payment.write",
      parse: async (incoming) => {
        const parsed = command.safeParse(await parseJson<unknown>(incoming));
        if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid payment", 422);
        return parsed.data;
      },
      run: async (input, { database }) => recordPayment(database, { orderId: (await params).id, ...input }),
    });
    return success(result, 201);
  } catch (error) {
    return failure(error);
  }
}
