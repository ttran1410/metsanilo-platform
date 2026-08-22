import { z } from "zod";
import { db } from "@/db/client";
import { createPublicReview, getReviewRollup, getReviewsVisibility, listPublishedReviews } from "@/domain/reviews";
import { failure, success } from "../../response";
import { DomainError } from "@/domain/errors";

export const runtime = "nodejs";
const input = z.object({
  displayName: z.string().max(80).optional(),
  isAnonymous: z.boolean().default(false),
  crmConsent: z.boolean().default(false),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().min(10).max(2000),
  contact: z.string().max(254).optional(),
  productId: z.string().max(100).optional(),
  publicationAcknowledgement: z.literal(true),
  locale: z.enum(["fi", "en"]),
});

export async function GET(request: Request) {
  try {
    if (!(await getReviewsVisibility(db()))) return success({ reviews: [], rollup: { ratingAvg: 5.0, reviewCount: 0, starDistribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 } } });
    const locale = new URL(request.url).searchParams.get("locale") === "fi" ? "fi" : "en";
    const reviewsList = await listPublishedReviews(db(), { locale });
    const rollup = await getReviewRollup(db());
    return success({ reviews: reviewsList, rollup });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!(await getReviewsVisibility(db()))) throw new DomainError("NOT_FOUND", "Reviews are not available", 404);
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid review", 422);
    return success(
      await createPublicReview(db(), {
        displayName: parsed.data.displayName,
        isAnonymous: parsed.data.isAnonymous,
        crmConsent: parsed.data.crmConsent,
        rating: parsed.data.rating,
        originalText: parsed.data.reviewText,
        publicationAcknowledgement: parsed.data.publicationAcknowledgement,
        contact: parsed.data.contact,
        productId: parsed.data.productId,
        locale: parsed.data.locale,
      }),
      201,
    );
  } catch (error) {
    return failure(error);
  }
}
