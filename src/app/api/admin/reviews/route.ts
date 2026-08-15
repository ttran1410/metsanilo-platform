import { z } from "zod";
import { db } from "@/db/client";
import { confirmManualReview, createManualReview, listManagerReviews, moderateReview } from "@/domain/reviews";
import { requirePermission } from "@/domain/access";
import { failure, success } from "../../response";

export const runtime = "nodejs";
const command = z.object({ id: z.string().min(1), status: z.enum(["APPROVED", "REJECTED", "HIDDEN", "ARCHIVED"]), displayText: z.string().max(2000).optional(), reason: z.string().max(500).optional(), featured: z.boolean().optional(), featuredUntil: z.string().optional(), confirmSource: z.enum(["SMS", "WHATSAPP", "PHONE", "OTHER"]).optional(), confirmNote: z.string().max(500).optional() });
export async function GET(request: Request) { try { await requirePermission(db(), request, "reviews.read"); return success(await listManagerReviews(db())); } catch (error) { return failure(error); } }
export async function POST(request: Request) { try { const actor = await requirePermission(db(), request, "reviews.create"); const parsed = z.object({ displayName: z.string().min(2).max(80), rating: z.number().int().min(1).max(5), originalText: z.string().min(10).max(2000), orderId: z.string().optional(), productId: z.string().optional() }).safeParse(await request.json()); if (!parsed.success) return failure(new Error("Invalid manual review")); return success(await createManualReview(db(), { ...parsed.data, actor: actor.email ?? actor.username ?? actor.id }), 201); } catch (error) { return failure(error); } }
export async function PATCH(request: Request) { try { const actor = await requirePermission(db(), request, "reviews.moderate"); const parsed = command.safeParse(await request.json()); if (!parsed.success) return failure(new Error("Invalid review moderation command")); const actorName = actor.email ?? actor.username ?? actor.id; if (parsed.data.confirmSource) return success(await confirmManualReview(db(), { id: parsed.data.id, source: parsed.data.confirmSource, note: parsed.data.confirmNote, actor: actorName })); return success(await moderateReview(db(), { ...parsed.data, actor: actorName })); } catch (error) { return failure(error); } }
