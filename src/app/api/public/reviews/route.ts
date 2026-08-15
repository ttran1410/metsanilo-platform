import { z } from "zod";
import { db } from "@/db/client";
import { createPublicReview, getReviewsVisibility, listPublishedReviews } from "@/domain/reviews";
import { failure, success } from "../../response";
import { DomainError } from "@/domain/errors";

export const runtime = "nodejs";
const input = z.object({ displayName: z.string().min(2).max(80), rating: z.number().int().min(1).max(5), reviewText: z.string().min(10).max(2000), contact: z.string().max(254).optional(), productId: z.string().max(100).optional(), publicationAcknowledgement: z.literal(true), locale: z.enum(["fi", "en"]) });

export async function GET() { try { if (!(await getReviewsVisibility(db()))) return success([]); return success(await listPublishedReviews(db())); } catch (error) { return failure(error); } }
export async function POST(request: Request) { try { if (!(await getReviewsVisibility(db()))) throw new DomainError("NOT_FOUND", "Reviews are not available", 404); const parsed = input.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid review", 422); return success(await createPublicReview(db(), { displayName: parsed.data.displayName, rating: parsed.data.rating, originalText: parsed.data.reviewText, publicationAcknowledgement: parsed.data.publicationAcknowledgement, contact: parsed.data.contact, productId: parsed.data.productId, locale: parsed.data.locale }), 201); } catch (error) { return failure(error); } }
