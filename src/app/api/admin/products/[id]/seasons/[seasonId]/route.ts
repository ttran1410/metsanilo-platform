import { z } from "zod";
import { parseJson } from "../../../../module";
import { DomainError } from "@/domain/errors";
import { deleteAdminSeason, extendAdminSeason, getAdminSeasonSummary, updateAdminSeason } from "@/domain/admin-season-actions";
import { failure, success } from "../../../../../response";
import { executeAdmin } from "../../../../module";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; seasonId: string }> }
) {
  try {
    const { id, seasonId } = await context.params;
    const summary = await executeAdmin(request, { permission: "catalog.product.read", parse: async () => ({ id, seasonId }), run: async ({ seasonId: selectedSeasonId }, { database, context }) => getAdminSeasonSummary(database, { actor: context.actor, shop: { id: env().SHOP_ID } }, selectedSeasonId) });
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
    const { seasonId } = await context.params;
    const result = await executeAdmin(request, { permission: "catalog.product.write", parse: async (incoming) => { const parsed = updateSeasonSchema.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid season update payload", 422); return parsed.data; }, run: async (input, { database, context: { actor } }) => input.action === "extend" ? extendAdminSeason(database, { actor, shop: { id: env().SHOP_ID } }, seasonId, input.additionalDays ?? 7) : updateAdminSeason(database, { actor, shop: { id: env().SHOP_ID } }, seasonId, { nameFi: input.nameFi, nameEn: input.nameEn, startDate: input.startDate, endDate: input.endDate, status: input.status, targetVolumeMl: input.targetVolumeMl, notes: input.notes }) });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; seasonId: string }> }
) {
  try {
    const { seasonId } = await context.params;
    const result = await executeAdmin(request, { permission: "catalog.product.write", parse: async () => seasonId, run: async (id, { database, context: { actor } }) => { await deleteAdminSeason(database, { actor, shop: { id: env().SHOP_ID } }, id); return { deleted: true }; } });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
