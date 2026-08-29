import { z } from "zod";
import { parseJson } from "../../../module";
import { DomainError } from "@/domain/errors";
import { cloneAdminSeason, createAdminSeason, listAdminSeasons } from "@/domain/admin-season-actions";
import { failure, success } from "../../../../response";
import { executeAdmin } from "../../../module";
import { env } from "@/lib/env";

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
    const { id } = await context.params;
    const seasons = await executeAdmin(request, { permission: "catalog.product.read", parse: async () => id, run: async (productId, { database, context }) => listAdminSeasons(database, { actor: context.actor, shop: { id: env().SHOP_ID } }, productId) });
    return success(seasons);
  } catch (error) {
    return failure(error, request);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await executeAdmin(request, { permission: "catalog.product.write", parse: async (incoming) => parseJson<unknown>(incoming), run: async (payload, { database, context: { actor } }) => {
      const clone = cloneSeasonSchema.safeParse(payload);
      if (clone.success) return cloneAdminSeason(database, { actor, shop: { id: env().SHOP_ID } }, clone.data.sourceSeasonId, clone.data, id);
      const parsed = createSeasonSchema.safeParse(payload);
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid season inputs", 422);
      return createAdminSeason(database, { actor, shop: { id: env().SHOP_ID } }, { ...parsed.data, productId: id });
    } });
    return success(result, 201);
  } catch (error) {
    return failure(error, request);
  }
}
