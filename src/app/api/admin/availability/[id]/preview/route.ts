import { z } from "zod";
import { previewAvailabilityUpdate } from "@/domain/availability";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";

const command = z.object({
  expectedVersion: z.number().int().positive(),
  capacityMl: z.number().int().nonnegative(),
  manualSoldOut: z.boolean(),
  acceptsOrders: z.boolean().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const result = await executeAdmin(request, {
      permission: "availability.write",
      parse: async (incoming) => {
        const parsed = command.safeParse(await parseJson<unknown>(incoming));
        if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability preview payload", 422);
        return parsed.data;
      },
      run: async (input, { database }) => {
        const { id } = await context.params;
        return previewAvailabilityUpdate(database, { id, ...input });
      },
    });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
