import { z } from "zod";
import { transitionOrder } from "@/domain/orders";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ expectedVersion: z.number().int().positive() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await executeAdmin(request, { permission: "orders.update", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid pickup confirmation", 422); return parsed.data; }, run: async (input, { database }) => transitionOrder(database, { orderId: (await params).id, status: "PICKED_UP", ...input }) });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
