import { z } from "zod";
import { db } from "@/db/client";
import { confirmManualReview, createManualReview, linkReviewToCustomerOrOrder, listManagerReviews, moderateReview, replyToReview } from "@/domain/reviews";
import { requirePermission } from "@/domain/access";
import { failure, success } from "../../response";

import { fromZodError } from "@/domain/errors";

export const runtime = "nodejs";

const commandSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["moderate", "link_identity"]).optional(),
  orderId: z.string().optional(),
  customerId: z.string().optional(),
  status: z.enum(["APPROVED", "REJECTED", "HIDDEN", "ARCHIVED"]).optional(),
  displayText: z.string().max(2000).optional(),
  reason: z.string().max(500).optional(),
  rejectionReason: z.enum(["SPAM", "PROFANITY", "UNRELATED", "COMPETITOR", "OTHER"]).optional(),
  featured: z.boolean().optional(),
  featuredUntil: z.string().optional(),
  verifiedBuyer: z.boolean().optional(),
  confirmSource: z.enum(["SMS", "WHATSAPP", "PHONE", "OTHER"]).optional(),
  confirmNote: z.string().max(500).optional(),
  sellerReplyText: z.string().max(2000).optional(),
});

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "reviews.read");
    return success(await listManagerReviews(db()));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "reviews.create");
    const parsed = z
      .object({
        displayName: z.string().min(2).max(80),
        rating: z.number().int().min(1).max(5),
        originalText: z.string().min(10).max(2000),
        orderId: z.string().optional(),
        productId: z.string().optional(),
        verifiedBuyer: z.boolean().optional(),
        acknowledgementSource: z.enum(["SMS", "WHATSAPP", "PHONE", "OTHER"]).optional(),
      })
      .safeParse(await request.json());

    if (!parsed.success) return failure(fromZodError(parsed.error, "Invalid manual review payload"));

    const actorName = actor.email ?? actor.username ?? actor.id;
    return success(await createManualReview(db(), { ...parsed.data, actor: actorName }), 201);
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "reviews.moderate");
    const parsed = commandSchema.safeParse(await request.json());
    if (!parsed.success) return failure(fromZodError(parsed.error, "Invalid review moderation payload"));

    const actorName = actor.email ?? actor.username ?? actor.id;

    if (parsed.data.action === "link_identity" || (parsed.data.orderId !== undefined || parsed.data.customerId !== undefined)) {
      return success(
        await linkReviewToCustomerOrOrder(db(), {
          reviewId: parsed.data.id,
          orderId: parsed.data.orderId,
          customerId: parsed.data.customerId,
          verifiedBuyer: parsed.data.verifiedBuyer,
          actor: actorName,
        }),
      );
    }

    if (parsed.data.sellerReplyText !== undefined) {
      return success(await replyToReview(db(), { id: parsed.data.id, replyText: parsed.data.sellerReplyText, actor: actorName }));
    }

    if (parsed.data.confirmSource) {
      return success(
        await confirmManualReview(db(), {
          id: parsed.data.id,
          source: parsed.data.confirmSource,
          note: parsed.data.confirmNote,
          actor: actorName,
        }),
      );
    }

    return success(
      await moderateReview(db(), {
        id: parsed.data.id,
        status: parsed.data.status,
        displayText: parsed.data.displayText,
        reason: parsed.data.reason,
        rejectionReason: parsed.data.rejectionReason,
        featured: parsed.data.featured,
        featuredUntil: parsed.data.featuredUntil,
        verifiedBuyer: parsed.data.verifiedBuyer,
        actor: actorName,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}

