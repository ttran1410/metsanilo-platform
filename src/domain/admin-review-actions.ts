import type { Database } from "@/db/client";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { bulkModerateReviews, deleteReview, linkReviewToCustomerOrOrder, moderateReview, replyToReview, updateFullReview, updateReviewPublicationIdentity } from "./reviews";

function actorName(context: AdminActionContext) {
  assertAdminActionContext(context);
  return context.actor.email ?? context.actor.id;
}

export type AdminReviewModerationInput = Parameters<typeof moderateReview>[1];
export async function moderateAdminReview(database: Database, context: AdminActionContext, input: AdminReviewModerationInput) { return moderateReview(database, { ...input, actor: actorName(context) }); }

export type AdminReviewBulkModerationInput = Parameters<typeof bulkModerateReviews>[1];
export async function bulkModerateAdminReviews(database: Database, context: AdminActionContext, input: AdminReviewBulkModerationInput) { return bulkModerateReviews(database, { ...input, actor: actorName(context) }); }

export type AdminReviewReplyInput = Parameters<typeof replyToReview>[1];
export async function replyAdminToReview(database: Database, context: AdminActionContext, input: AdminReviewReplyInput) { return replyToReview(database, { ...input, actor: actorName(context) }); }

export type AdminReviewLinkInput = Parameters<typeof linkReviewToCustomerOrOrder>[1];
export async function linkAdminReviewIdentity(database: Database, context: AdminActionContext, input: AdminReviewLinkInput) { return linkReviewToCustomerOrOrder(database, { ...input, actor: actorName(context) }); }

export type AdminReviewUpdateInput = Parameters<typeof updateFullReview>[1];
export async function updateAdminReview(database: Database, context: AdminActionContext, input: AdminReviewUpdateInput) { return updateFullReview(database, { ...input, actor: actorName(context) }); }

export type AdminReviewPublicationIdentityInput = Parameters<typeof updateReviewPublicationIdentity>[1];
export async function updateAdminReviewPublicationIdentity(database: Database, context: AdminActionContext, input: AdminReviewPublicationIdentityInput) { return updateReviewPublicationIdentity(database, { ...input, actor: actorName(context) }); }

export type AdminReviewDeleteInput = Parameters<typeof deleteReview>[1];
export async function deleteAdminReview(database: Database, context: AdminActionContext, input: AdminReviewDeleteInput) { return deleteReview(database, { ...input, actor: actorName(context) }); }
