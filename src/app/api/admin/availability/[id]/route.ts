import { z } from "zod";
import { db } from "@/db/client";
import { authenticateAdmin, parseJson } from "../../module";
import { updateAvailability } from "@/domain/availability";
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
    const parsed = command.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability command", 422);
    const { id } = await params;
    const permission = parsed.data.cutoffOverride !== undefined ? "availability.cutoff.override" : parsed.data.manualSoldOut ? "availability.sold_out" : "availability.write";
    const context = await authenticateAdmin(request, permission);
    return success(await updateAvailability(db(), { id, ...parsed.data, actor: context.actor.email ?? context.actor.id }));
  } catch (error) {
    return failure(error);
  }
}
