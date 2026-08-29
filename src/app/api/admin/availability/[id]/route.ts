import { z } from "zod";
import { updateAdminAvailability } from "@/domain/admin-availability-actions";
import { executeAdmin, authenticateAdminAny, parseJson } from "../../module";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";

export const runtime = "nodejs";

const command = z.object({
  expectedVersion: z.number().int().positive(),
  capacityMl: z.number().int().nonnegative(),
  manualSoldOut: z.boolean(),
  soldOutReason: z.string().max(500).optional(),
  acceptsOrders: z.boolean().optional(),
  cutoffOverride: z.enum(["OPEN", "CLOSED"]).nullable().optional(),
  source: z.enum(["MANUAL_EDIT", "QUICK_ADJUST"]).optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authenticateAdminAny(request, ["availability.write", "availability.sold_out", "availability.cutoff.override"]);
    const parsed = command.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability command", 422);
    const { id } = await params;
    const permission = parsed.data.cutoffOverride !== undefined ? "availability.cutoff.override" : parsed.data.manualSoldOut ? "availability.sold_out" : "availability.write";
    const result = await executeAdmin(request, { permission, parse: async () => parsed.data, run: async (input, { database, context }) => updateAdminAvailability(database, { actor: context.actor, shop: { id: context.shop.shopId } }, id, input) });
    return success(result);
  } catch (error) {
    return failure(error, request);
  }
}
