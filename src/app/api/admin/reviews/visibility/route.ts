import { z } from "zod";
import { getAdminReviewsVisibility, setAdminReviewsVisibility } from "@/domain/admin-review-actions";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { executeAdmin, parseJson } from "../../module";

export const runtime = "nodejs";
export async function GET(request: Request) { try { const result = await executeAdmin(request, { permission: "reviews.visibility", parse: async () => undefined, run: async (_input, { database, context }) => ({ visible: await getAdminReviewsVisibility(database, { actor: context.actor, shop: { id: context.shop.shopId } }) }) }); return success(result); } catch (error) { return failure(error, request); } }
export async function PUT(request: Request) { try { const result = await executeAdmin(request, { permission: "reviews.visibility", parse: async (incoming) => { const parsed = z.object({ visible: z.boolean() }).safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid visibility", 422); return parsed.data; }, run: async ({ visible }, { database, context: { actor, shop } }) => ({ visible: await setAdminReviewsVisibility(database, { actor, shop: { id: shop.shopId } }, visible), updatedBy: actor.email ?? actor.username ?? actor.id }) }); return success(result); } catch (error) { return failure(error, request); } }
