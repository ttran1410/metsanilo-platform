import { z } from "zod";
import { db } from "@/db/client";
import { getReviewsVisibility, setReviewsVisibility } from "@/domain/reviews";
import { requirePermission } from "@/domain/access";
import { failure, success } from "../../../response";

export const runtime = "nodejs";
export async function GET(request: Request) { try { await requirePermission(db(), request, "reviews.visibility"); return success({ visible: await getReviewsVisibility(db()) }); } catch (error) { return failure(error); } }
export async function PUT(request: Request) { try { const actor = await requirePermission(db(), request, "reviews.visibility"); const parsed = z.object({ visible: z.boolean() }).safeParse(await request.json()); if (!parsed.success) throw new Error("Invalid visibility"); const visible = await setReviewsVisibility(db(), parsed.data.visible); return success({ visible, updatedBy: actor.email ?? actor.username ?? actor.id }); } catch (error) { return failure(error); } }
