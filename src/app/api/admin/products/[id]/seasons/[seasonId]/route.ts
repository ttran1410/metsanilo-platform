import { z } from "zod";
import { executeAdminRoute, parseJson } from "../../../../module";
import { DomainError } from "@/domain/errors";
import { deleteAdminSeason, extendAdminSeason, getAdminSeasonSummary, updateAdminSeason } from "@/domain/admin-season-actions";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; seasonId: string }> }
) {
  return executeAdminRoute(request, {
    permission: "catalog.product.read",
    parse: async () => context.params,
    run: async ({ id, seasonId }, { database, context: execContext }) => {
      const summary = await getAdminSeasonSummary(database, { actor: execContext.actor, shop: { id: execContext.shop.shopId } }, seasonId);
      if (summary.season.productId !== id) throw new DomainError("NOT_FOUND", "Harvest season not found", 404);
      return summary;
    },
  });
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
  return executeAdminRoute(request, {
    permission: "catalog.product.write",
    parse: async (incoming) => {
      const parsed = updateSeasonSchema.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid season update payload", 422);
      return parsed.data;
    },
    run: async (input, { database, context: { actor, shop } }) => {
      const { seasonId } = await context.params;
      return input.action === "extend"
        ? extendAdminSeason(database, { actor, shop: { id: shop.shopId } }, seasonId, input.additionalDays ?? 7)
        : updateAdminSeason(database, { actor, shop: { id: shop.shopId } }, seasonId, {
            nameFi: input.nameFi,
            nameEn: input.nameEn,
            startDate: input.startDate,
            endDate: input.endDate,
            status: input.status,
            targetVolumeMl: input.targetVolumeMl,
            notes: input.notes,
          });
    },
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; seasonId: string }> }
) {
  return executeAdminRoute(request, {
    permission: "catalog.product.write",
    parse: async () => (await context.params).seasonId,
    run: async (id, { database, context: { actor, shop } }) => {
      await deleteAdminSeason(database, { actor, shop: { id: shop.shopId } }, id);
      return { deleted: true };
    },
  });
}

