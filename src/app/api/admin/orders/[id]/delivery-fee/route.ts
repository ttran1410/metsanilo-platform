import { z } from "zod";
import { setDeliveryFee } from "@/domain/orders";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ expectedVersion: z.number().int().positive(), deliveryFeeCents: z.number().int().nonnegative() });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await executeAdmin(request, { permission: "delivery.override", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid delivery fee", 422); return parsed.data; }, run: async (input, { database }) => setDeliveryFee(database, { orderId: (await params).id, ...input }) });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
