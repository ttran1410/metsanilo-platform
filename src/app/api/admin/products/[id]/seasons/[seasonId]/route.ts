import { z } from "zod";
import { db } from "@/db/client";
import { authenticateAdmin, parseJson } from "../../../../module";
import { DomainError } from "@/domain/errors";
import { deleteHarvestSeason, extendHarvestSeason, getHarvestSeasonSummary, updateHarvestSeason } from "@/domain/seasons";
import { failure, success } from "../../../../../response";
import { executeAdmin } from "../../../../module";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; seasonId: string }> }
) {
  try {
    const { id, seasonId } = await context.params;
    const summary = await executeAdmin(request, { permission: "catalog.product.read", parse: async () => ({ id, seasonId }), run: async ({ seasonId: selectedSeasonId }, { database }) => getHarvestSeasonSummary(database, selectedSeasonId) });
    if (summary.season.productId !== id) throw new DomainError("NOT_FOUND", "Harvest season not found", 404);
    return success(summary);
  } catch (error) {
    return failure(error);
  }
}

const updateSeasonSchema = z.object({
  action: z.enum(["update", "extend"]).optional().default("update"),
  nameFi: z.string().min(2).max(120).optional(),
  nameEn: z.string().min(2).max(120).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["UPCOMING", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  additionalDays: z.number().min(1).max(90).optional(),
  targetVolumeMl: z.number().int().positive().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; seasonId: string }> }
) {
  try {
    const actor = (await authenticateAdmin(request, "catalog.product.write")).actor;
    const actorName = actor.email ?? actor.username ?? actor.id;
    const { seasonId } = await context.params;

    const parsed = updateSeasonSchema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid season update payload", 422);

    if (parsed.data.action === "extend") {
      const extended = await extendHarvestSeason(db(), seasonId, parsed.data.additionalDays ?? 7, actorName);
      return success(extended);
    }

    const updated = await updateHarvestSeason(
      db(),
      seasonId,
      {
        nameFi: parsed.data.nameFi,
        nameEn: parsed.data.nameEn,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        status: parsed.data.status,
        targetVolumeMl: parsed.data.targetVolumeMl,
        notes: parsed.data.notes,
      },
      actorName
    );

    return success(updated);
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; seasonId: string }> }
) {
  try {
    const actor = (await authenticateAdmin(request, "catalog.product.write")).actor;
    const actorName = actor.email ?? actor.username ?? actor.id;
    const { seasonId } = await context.params;

    await deleteHarvestSeason(db(), seasonId, actorName);
    return success({ deleted: true });
  } catch (error) {
    return failure(error);
  }
}
