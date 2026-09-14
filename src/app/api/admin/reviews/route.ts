import { z } from "zod";
import { DomainError, fromZodError } from "@/domain/errors";
import { adminQueryParam, hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { authenticateAdmin, executeAdminRoute, parseJson } from "../module";
import { bulkModerateAdminReviews, confirmAdminReview, createAdminReview, deleteAdminReview, getAdminReviewDetail, getAdminReviews, linkAdminReviewIdentity, moderateAdminReview, replyAdminToReview, updateAdminReview, updateAdminReviewPublicationIdentity } from "@/domain/admin-review-actions";

export const runtime = "nodejs";

const commandSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["moderate", "link_identity", "publication_identity"]).optional(),
  orderId: z.string().optional(),
  customerId: z.string().optional(),
  status: z.enum(["APPROVED", "REJECTED", "HIDDEN", "ARCHIVED"]).optional(),
  displayText: z.string().max(2000).optional(),
  reason: z.string().max(500).optional(),
  rejectionReason: z.enum(["SPAM", "PROFANITY", "UNRELATED", "COMPETITOR", "OTHER"]).optional(),
  featured: z.boolean().optional(),
  featuredUntil: z.string().optional(),
  verifiedBuyer: z.boolean().optional(),
  confirmSource: z.string().max(80).optional(),
  confirmNote: z.string().max(500).optional(),
  sellerReplyText: z.string().max(2000).optional(),
  isAnonymous: z.boolean().optional(),
  reviewerName: z.string().max(80).optional(),
  consentSource: z.string().max(80).optional(),
  consentNote: z.string().max(500).optional(),
});

const manualReviewSchema = z.object({
  displayName: z.string().min(2).max(80),
  isAnonymous: z.boolean().optional(),
  reviewerName: z.string().max(80).optional(),
  rating: z.number().int().min(1).max(5),
  originalText: z.string().min(10).max(2000),
  orderId: z.string().optional(),
  productId: z.string().optional(),
  verifiedBuyer: z.boolean().optional(),
  acknowledgementSource: z.string().max(80).optional(),
  publicationConsentNote: z.string().max(500).optional(),
});

const editReviewSchema = z.object({
  id: z.string().min(1),
  action: z.literal("publication_identity").optional(),
  displayName: z.string().min(2).max(80).optional(),
  isAnonymous: z.boolean().optional(),
  reviewerName: z.string().max(80).optional(),
  consentSource: z.string().max(80).optional(),
  consentNote: z.string().max(500).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  source: z.enum(["PUBLIC_FORM", "MANUAL_IMPORT"]).optional(),
  acknowledgementSource: z.string().max(80).optional(),
  originalText: z.string().min(10).max(2000).optional(),
  displayText: z.string().max(2000).optional(),
  orderId: z.string().optional(),
  verifiedBuyer: z.boolean().optional(),
});

export async function GET(request: Request) {
  return executeAdminRoute(request, {
    permission: "reviews.read",
    run: async (_input, { database, context }) => {
      if (hasListQuery(request)) {
        const rating = adminQueryParam(request, "rating");
        return getAdminReviews(database, { actor: context.actor, shop: { id: context.shop.shopId } }, {
          list: parseAdminListQuery(request),
          filters: {
            status: adminQueryParam(request, "status"),
            rating: rating ? Number(rating) : undefined,
            verification: adminQueryParam(request, "verification"),
            productId: adminQueryParam(request, "productId"),
            source: adminQueryParam(request, "source"),
            featured: adminQueryParam(request, "featured") === undefined ? undefined : adminQueryParam(request, "featured") === "true",
            hasReply: adminQueryParam(request, "hasReply") === "true" ? true : undefined,
          },
        });
      }
      const id = new URL(request.url).searchParams.get("id");
      return id
        ? getAdminReviewDetail(database, { actor: context.actor, shop: { id: context.shop.shopId } }, id)
        : getAdminReviews(database, { actor: context.actor, shop: { id: context.shop.shopId } });
    },
  });
}

export async function POST(request: Request) {
  return executeAdminRoute(request, {
    permission: "reviews.create",
    status: 201,
    parse: async (incoming) => {
      const parsed = manualReviewSchema.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw fromZodError(parsed.error, "Invalid manual review payload");
      if (parsed.data.verifiedBuyer && (!parsed.data.orderId || !parsed.data.orderId.trim())) {
        throw new DomainError("VALIDATION_ERROR", "Order proof is required when marking as Verified Buyer.", 422);
      }
      return parsed.data;
    },
    run: async (input, { database, context }) =>
      createAdminReview(database, { actor: context.actor, shop: { id: context.shop.shopId } }, input),
  });
}

export async function PUT(request: Request) {
  return executeAdminRoute(request, {
    permission: "reviews.moderate",
    parse: async (incoming) => {
      const parsed = editReviewSchema.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw fromZodError(parsed.error, "Invalid edit review payload");
      return parsed.data;
    },
    run: async (input, { database, context }) => {
      const actionContext = { actor: context.actor, shop: { id: context.shop.shopId } };
      if (input.action === "publication_identity") {
        const updatedIdentity = await updateAdminReviewPublicationIdentity(database, actionContext, {
          id: input.id,
          isAnonymous: input.isAnonymous ?? false,
          reviewerName: input.reviewerName,
          consentSource: input.consentSource ?? "",
          consentNote: input.consentNote ?? "",
        });
        const reviewFields = {
          displayName: input.displayName,
          rating: input.rating,
          source: input.source,
          acknowledgementSource: input.acknowledgementSource,
          originalText: input.originalText,
          displayText: input.displayText,
          orderId: input.orderId,
          verifiedBuyer: input.verifiedBuyer,
        };
        const hasReviewEdits = Object.values(reviewFields).some((value) => value !== undefined);
        return hasReviewEdits
          ? await updateAdminReview(database, actionContext, { id: input.id, ...reviewFields })
          : updatedIdentity;
      }
      return updateAdminReview(database, actionContext, input);
    },
  });
}

export async function DELETE(request: Request) {
  return executeAdminRoute(request, {
    permission: "reviews.moderate",
    parse: async () => {
      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      if (!id) throw new DomainError("VALIDATION_ERROR", "Review ID required", 400);
      return { id };
    },
    run: async (input, { database, context: { actor, shop } }) =>
      deleteAdminReview(database, { actor, shop: { id: shop.shopId } }, input),
  });
}

export async function PATCH(request: Request) {
  return executeAdminRoute(request, {
    permissions: ["reviews.moderate", "reviews.write"],
    parse: async (incoming) => parseJson<Record<string, unknown>>(incoming),
    run: async (payload, { database, context }) => {
      const actionContext = { actor: context.actor, shop: { id: context.shop.shopId } };

      const bulk = z.object({
        action: z.literal("bulk_moderate"),
        ids: z.array(z.string().min(1)).min(1).max(100),
        status: z.enum(["APPROVED", "REJECTED", "HIDDEN", "ARCHIVED"]),
        reason: z.string().max(500).optional(),
        rejectionReason: z.enum(["SPAM", "PROFANITY", "UNRELATED", "COMPETITOR", "OTHER"]).optional(),
      }).safeParse(payload);

      if (bulk.success) {
        await authenticateAdmin(request, "reviews.moderate");
        return bulkModerateAdminReviews(database, actionContext, bulk.data);
      }

      const parsed = commandSchema.safeParse(payload);
      if (!parsed.success) throw fromZodError(parsed.error, "Invalid review moderation payload");

      if (parsed.data.action === "publication_identity") {
        return updateAdminReviewPublicationIdentity(database, actionContext, {
          id: parsed.data.id,
          isAnonymous: parsed.data.isAnonymous ?? false,
          reviewerName: parsed.data.reviewerName,
          consentSource: parsed.data.consentSource ?? "",
          consentNote: parsed.data.consentNote ?? "",
        });
      }

      await authenticateAdmin(request, "reviews.moderate");

      if (parsed.data.action === "link_identity" || (parsed.data.orderId !== undefined || parsed.data.customerId !== undefined)) {
        return linkAdminReviewIdentity(database, actionContext, {
          reviewId: parsed.data.id,
          orderId: parsed.data.orderId,
          customerId: parsed.data.customerId,
          verifiedBuyer: parsed.data.verifiedBuyer,
        });
      }

      if (parsed.data.sellerReplyText !== undefined) {
        return replyAdminToReview(database, actionContext, {
          id: parsed.data.id,
          replyText: parsed.data.sellerReplyText!,
        });
      }

      if (parsed.data.confirmSource) {
        return confirmAdminReview(database, actionContext, {
          id: parsed.data.id,
          source: parsed.data.confirmSource!,
          note: parsed.data.confirmNote,
        });
      }

      return moderateAdminReview(database, actionContext, {
        id: parsed.data.id,
        status: parsed.data.status,
        displayText: parsed.data.displayText,
        reason: parsed.data.reason,
        rejectionReason: parsed.data.rejectionReason,
        featured: parsed.data.featured,
        featuredUntil: parsed.data.featuredUntil,
        verifiedBuyer: parsed.data.verifiedBuyer,
      });
    },
  });
}

