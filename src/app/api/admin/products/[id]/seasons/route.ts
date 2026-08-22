import { z } from "zod";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { cloneHarvestSeason, createHarvestSeason, listHarvestSeasons } from "@/domain/seasons";
import { failure, success } from "../../../../response";

export const runtime = "nodejs";

const createSeasonSchema = z.object({
  nameFi: z.string().min(2).max(120),
  nameEn: z.string().min(2).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["UPCOMING", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  targetVolumeMl: z.number().int().positive().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const cloneSeasonSchema = z.object({
  action: z.literal("clone"),
  sourceSeasonId: z.string().min(1),
  nameFi: z.string().min(2).max(120).optional(),
  nameEn: z.string().min(2).max(120).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["UPCOMING", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  targetVolumeMl: z.number().int().positive().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(db(), request, "catalog.product.read");
    const { id } = await context.params;
    const seasons = await listHarvestSeasons(db(), id);
    return success(seasons);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(db(), request, "catalog.product.write");
    const actorName = actor.email ?? actor.username ?? actor.id;
    const { id } = await context.params;

    const payload = await request.json();
    const clone = cloneSeasonSchema.safeParse(payload);
    if (clone.success) {
      const season = await cloneHarvestSeason(db(), clone.data.sourceSeasonId, clone.data, actorName, id);
      return success(season, 201);
    }

    const parsed = createSeasonSchema.safeParse(payload);
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid season inputs", 422);

    const season = await createHarvestSeason(
      db(),
      {
        productId: id,
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

    return success(season);
  } catch (error) {
    return failure(error);
  }
}
