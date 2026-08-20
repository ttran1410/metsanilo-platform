import { z } from "zod";
import { db } from "@/db/client";
import {
  confirmManualReview,
  bulkModerateReviews,
  createManualReview,
  deleteReview,
  linkReviewToCustomerOrOrder,
  listManagerReviews,
  getManagerReviewDetail,
  moderateReview,
  replyToReview,
  updateFullReview,
} from "@/domain/reviews";
import { requirePermission } from "@/domain/access";
import { failure, success } from "../../response";
import { fromZodError } from "@/domain/errors";
import { adminQueryParam, hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { searchManagerReviews } from "@/domain/admin-search";

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
  confirmSource: z.string().max(80).optional(),
  confirmNote: z.string().max(500).optional(),
  sellerReplyText: z.string().max(2000).optional(),
});

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "reviews.read");
    if (hasListQuery(request)) {
      const rating = adminQueryParam(request, "rating");
      return success(await searchManagerReviews(db(), parseAdminListQuery(request), {
        status: adminQueryParam(request, "status"),
        rating: rating ? Number(rating) : undefined,
        verification: adminQueryParam(request, "verification"),
        productId: adminQueryParam(request, "productId"),
        source: adminQueryParam(request, "source"),
        featured: adminQueryParam(request, "featured") === undefined ? undefined : adminQueryParam(request, "featured") === "true",
        hasReply: adminQueryParam(request, "hasReply") === "true" ? true : undefined,
      }));
    }
    const id = new URL(request.url).searchParams.get("id");
    return success(id ? await getManagerReviewDetail(db(), id) : await listManagerReviews(db()));
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
        acknowledgementSource: z.string().max(80).optional(),
      })
      .safeParse(await request.json());

    if (!parsed.success) return failure(fromZodError(parsed.error, "Invalid manual review payload"));

    if (parsed.data.verifiedBuyer && (!parsed.data.orderId || !parsed.data.orderId.trim())) {
      return failure({
        message: "Order Reference, Phone, Facebook Profile, or Email proof is required when marking as Verified Buyer.",
        code: "VALIDATION_ERROR",
        status: 422,
      });
    }

    const actorName = actor.email ?? actor.username ?? actor.id;
    return success(await createManualReview(db(), { ...parsed.data, actor: actorName }), 201);
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "reviews.moderate");
    const parsed = z
      .object({
        id: z.string().min(1),
        displayName: z.string().min(2).max(80).optional(),
        rating: z.number().int().min(1).max(5).optional(),
        source: z.enum(["PUBLIC_FORM", "MANUAL_IMPORT"]).optional(),
        acknowledgementSource: z.string().max(80).optional(),
        originalText: z.string().min(10).max(2000).optional(),
        displayText: z.string().max(2000).optional(),
        orderId: z.string().optional(),
        verifiedBuyer: z.boolean().optional(),
      })
      .safeParse(await request.json());

    if (!parsed.success) return failure(fromZodError(parsed.error, "Invalid edit review payload"));

    const actorName = actor.email ?? actor.username ?? actor.id;
    return success(await updateFullReview(db(), { ...parsed.data, actor: actorName }));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "reviews.moderate");
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return failure({ message: "Review ID required", code: "VALIDATION_ERROR", status: 400 });

    const actorName = actor.email ?? actor.username ?? actor.id;
    return success(await deleteReview(db(), { id, actor: actorName }));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "reviews.moderate");
    const payload = await request.json();
    const bulk = z.object({
      action: z.literal("bulk_moderate"),
      ids: z.array(z.string().min(1)).min(1).max(100),
      status: z.enum(["APPROVED", "REJECTED", "HIDDEN", "ARCHIVED"]),
      reason: z.string().max(500).optional(),
      rejectionReason: z.enum(["SPAM", "PROFANITY", "UNRELATED", "COMPETITOR", "OTHER"]).optional(),
    }).safeParse(payload);
    if (bulk.success) {
      const actorName = actor.email ?? actor.username ?? actor.id;
      return success(await bulkModerateReviews(db(), { ...bulk.data, actor: actorName }));
    }

    const parsed = commandSchema.safeParse(payload);
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
