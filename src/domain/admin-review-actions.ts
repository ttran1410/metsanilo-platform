import type { Database } from "@/db/client";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { bulkModerateReviews, confirmManualReview, createManualReview, deleteReview, getReviewsVisibility, getManagerReviewDetail, linkReviewToCustomerOrOrder, listManagerReviews, moderateReview, replyToReview, setReviewsVisibility, updateFullReview, updateReviewPublicationIdentity } from "./reviews";
import { searchManagerReviews } from "./admin-search";
import type { AdminListQuery } from "@/lib/admin-list-query";

function actorName(context: AdminActionContext) {
  assertAdminActionContext(context);
  return context.actor.email ?? context.actor.id;
}

export type AdminReviewsQueryFilters = { status?: string; rating?: number; verification?: string; productId?: string; source?: string; featured?: boolean; hasReply?: boolean };
export async function getAdminReviews(database: Database, context: AdminActionContext, query?: { list?: AdminListQuery; filters?: AdminReviewsQueryFilters }) {
  assertAdminActionContext(context);
  return query?.list ? searchManagerReviews(database, query.list, query.filters) : listManagerReviews(database);
}

export async function getAdminReviewDetail(database: Database, context: AdminActionContext, reviewId: string) {
  assertAdminActionContext(context);
  return getManagerReviewDetail(database, reviewId);
}

export type AdminReviewModerationInput = Omit<Parameters<typeof moderateReview>[1], "actor">;
export type AdminReviewCreateInput = Omit<Parameters<typeof createManualReview>[1], "actor">;
export async function createAdminReview(database: Database, context: AdminActionContext, input: AdminReviewCreateInput) {
  return createManualReview(database, { ...input, actor: actorName(context) });
}

export async function moderateAdminReview(database: Database, context: AdminActionContext, input: AdminReviewModerationInput) { return moderateReview(database, { ...input, actor: actorName(context) }); }

export type AdminReviewBulkModerationInput = Omit<Parameters<typeof bulkModerateReviews>[1], "actor">;
export async function bulkModerateAdminReviews(database: Database, context: AdminActionContext, input: AdminReviewBulkModerationInput) { return bulkModerateReviews(database, { ...input, actor: actorName(context) }); }

export type AdminReviewReplyInput = Omit<Parameters<typeof replyToReview>[1], "actor">;
export async function replyAdminToReview(database: Database, context: AdminActionContext, input: AdminReviewReplyInput) { return replyToReview(database, { ...input, actor: actorName(context) }); }

export type AdminReviewLinkInput = Omit<Parameters<typeof linkReviewToCustomerOrOrder>[1], "actor">;
export async function linkAdminReviewIdentity(database: Database, context: AdminActionContext, input: AdminReviewLinkInput) { return linkReviewToCustomerOrOrder(database, { ...input, actor: actorName(context) }); }

export type AdminReviewUpdateInput = Omit<Parameters<typeof updateFullReview>[1], "actor">;
export async function updateAdminReview(database: Database, context: AdminActionContext, input: AdminReviewUpdateInput) { return updateFullReview(database, { ...input, actor: actorName(context) }); }

export type AdminReviewPublicationIdentityInput = Omit<Parameters<typeof updateReviewPublicationIdentity>[1], "actor">;
export async function updateAdminReviewPublicationIdentity(database: Database, context: AdminActionContext, input: AdminReviewPublicationIdentityInput) { return updateReviewPublicationIdentity(database, { ...input, actor: actorName(context) }); }

export type AdminReviewDeleteInput = Omit<Parameters<typeof deleteReview>[1], "actor">;
export async function deleteAdminReview(database: Database, context: AdminActionContext, input: AdminReviewDeleteInput) { return deleteReview(database, { ...input, actor: actorName(context) }); }

export type AdminReviewConfirmationInput = Omit<Parameters<typeof confirmManualReview>[1], "actor">;
export async function confirmAdminReview(database: Database, context: AdminActionContext, input: AdminReviewConfirmationInput) { return confirmManualReview(database, { ...input, actor: actorName(context) }); }
export async function getAdminReviewsVisibility(database: Database, context: AdminActionContext) { assertAdminActionContext(context); return getReviewsVisibility(database); }
export async function setAdminReviewsVisibility(database: Database, context: AdminActionContext, visible: boolean) { assertAdminActionContext(context); return setReviewsVisibility(database, visible); }
