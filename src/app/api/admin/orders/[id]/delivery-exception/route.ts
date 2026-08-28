import { z } from "zod";
import { addDeliveryException } from "@/domain/orders";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ type: z.enum(["CUSTOMER_UNAVAILABLE", "ADDRESS_ISSUE", "DELIVERY_DELAYED", "DELIVERY_FAILED", "RESCHEDULED"]), nextAction: z.string().min(1).max(120), note: z.string().max(1000).optional(), rescheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await executeAdmin(request, { permission: "orders.transition", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid delivery exception", 422); return parsed.data; }, run: async (input, { database }) => addDeliveryException(database, { orderId: (await params).id, ...input }) });
    return success(result);
  } catch (error) { return failure(error); }
}
