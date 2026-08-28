import { z } from "zod";
import { fromZodError } from "@/domain/errors";
import { transitionOrder } from "@/domain/orders";
import { failure, success } from "../../../../response";
import { executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";

const command = z.object({
  status: z.enum(["CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "CUSTOMER_DECLINED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED", "NO_SHOW", "REFUNDED"]),
  expectedVersion: z.number().int().positive(),
  reason: z.string().max(500).optional(),
  contactChannel: z.enum(["PHONE", "SMS", "EMAIL", "OTHER"]).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await executeAdmin(request, {
      permission: "orders.transition",
      parse: async (incoming) => {
        const parsed = command.safeParse(await parseJson<unknown>(incoming));
        if (!parsed.success) throw fromZodError(parsed.error, "Unable to update order status. Please check your inputs.");
        return parsed.data;
      },
      run: async (input, { database }) => transitionOrder(database, { orderId: (await params).id, ...input }),
    });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
