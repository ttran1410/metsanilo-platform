"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Ban, CheckCircle2, Eye, EyeOff, MessageSquare, Plus, ShieldCheck, Star, X } from "lucide-react";
import { AdminSearchField } from "../ui/admin-search-field";
import { AdminConfirmDialog, AdminEmptyState, AdminNotice, AdminPageHeader, useAdminDialogFocus } from "../presentation";
import { AdminPagination } from "../ui/admin-pagination";
import { AdminRowActionMenu, IconLink, IconLock, IconPencil, IconTrash, IconUser } from "../ui/admin-row-action-menu";
import { LinkIdentityModal } from "./link-identity-modal";
import { EditReviewModal } from "./edit-review-modal";
import { PublicationIdentityModal } from "./publication-identity-modal";
import { parseReviewsUrlState, serializeReviewsUrlState, type ReviewTab } from "../reviews-url-state";
import { getAdminOrderSources } from "../reference-data-cache";

type Review = {
  id: string;
  displayName: string;
  reviewerName?: string | null;
  isAnonymous?: boolean;
  contact: string | null;
  rating: number;
  originalText: string;
  displayText: string | null;
  source: "PUBLIC_FORM" | "MANUAL_IMPORT";
  status: "PENDING" | "PENDING_CONFIRMATION" | "APPROVED" | "REJECTED" | "HIDDEN" | "ARCHIVED";
  publicationAcknowledgement: boolean;
  acknowledgementSource: string | null;
  acknowledgedAt: string | null;
  verifiedBuyer: boolean;
  verificationType: "DIGITAL_ORDER" | "HISTORICAL_MATCH" | "STAFF_MANUAL" | "UNVERIFIED";
  featured: boolean;
  featuredUntil: string | null;
  moderationReason: string | null;
  rejectionReason: string | null;
  sellerReplyText: string | null;
  sellerRepliedAt: string | null;
  orderId: string | null;
  createdAt: string;
};

type RejectionReason = "SPAM" | "PROFANITY" | "UNRELATED" | "COMPETITOR" | "OTHER";

function maskContact(contact: string | null) {
  if (!contact) return null;
  if (contact.includes("@")) {
    const [name, domain] = contact.split("@");
    return `${name.slice(0, 2)}•••@${domain}`;
  }
  const compact = contact.replace(/\s/g, "");
  return compact.length > 7 ? `${compact.slice(0, 4)} ••• ${compact.slice(-4)}` : compact;
}

export function ReviewsManager({
  initial,
  loadInitialFromApi = false,
  canCreate,
  canModerate,
  canFeature,
}: {
  initial: Review[];
  loadInitialFromApi?: boolean;
  canCreate: boolean;
  canModerate: boolean;
  canFeature: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Review[]>(initial);
  const [loading, setLoading] = useState(loadInitialFromApi);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const initialUrlState = parseReviewsUrlState(searchParams);
  const [activeTab, setActiveTab] = useState<ReviewTab>(initialUrlState.activeTab);
  const [searchQuery, setSearchQuery] = useState(initialUrlState.searchQuery);

  useEffect(() => {
    // URL restoration is an external navigation synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (searchQuery !== initialUrlState.searchQuery) setSearchQuery(initialUrlState.searchQuery);
  }, [initialUrlState.searchQuery, searchQuery]);
  const [currentPage, setCurrentPage] = useState(initialUrlState.currentPage);
  const [pageSize, setPageSize] = useState(20);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const reviewsRequestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!loadInitialFromApi) return;
    const controller = new AbortController();
    reviewsRequestRef.current?.abort();
    reviewsRequestRef.current = controller;
    const params = new URLSearchParams({ q: searchQuery.trim(), page: String(currentPage), pageSize: String(pageSize) });
    if (activeTab === "approved" || activeTab === "rejected") params.set("status", activeTab.toUpperCase());
    if (activeTab === "pending") params.set("status", "PENDING");
    if (activeTab === "featured") { params.set("status", "APPROVED"); params.set("featured", "true"); }
    void fetch(`/api/admin/reviews?${params.toString()}`, { cache: "no-store", signal: controller.signal, headers: { "x-admin-request-scope": "reviews-list" } })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "Reviews unavailable");
        if (!controller.signal.aborted) { setRows(body.data.items ?? []); setServerTotal(body.data.total ?? 0); }
      })
      .catch((error) => { if (!(error instanceof DOMException && error.name === "AbortError")) setErrorMsg(error instanceof Error ? error.message : "Reviews unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeTab, currentPage, loadInitialFromApi, pageSize, searchQuery]);
  const [masterVisible, setMasterVisible] = useState(true);
  const [showManualModal, setShowManualModal] = useState(false);
  const manualReviewDialogRef = useAdminDialogFocus(showManualModal, () => setShowManualModal(false));
  const [modalVerifiedChecked, setModalVerifiedChecked] = useState(true);
  const [modalAnonymousChecked, setModalAnonymousChecked] = useState(false);

  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [identityReview, setIdentityReview] = useState<Review | null>(null);
  const [editingDisplayTextId, setEditingDisplayTextId] = useState<string | null>(null);
  const [draftDisplayText, setDraftDisplayText] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [draftReplyText, setDraftReplyText] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<RejectionReason>("SPAM");
  const [linkingReview, setLinkingReview] = useState<Review | null>(null);
  const [approvingReview, setApprovingReview] = useState<Review | null>(null);
  const [deletingReview, setDeletingReview] = useState<Review | null>(null);
  const [busyReviewId, setBusyReviewId] = useState<string | null>(null);
  const [sources, setSources] = useState<Array<{ key: string; labelEn: string }>>([
    { key: "WHATSAPP", labelEn: "WhatsApp" },
    { key: "FACEBOOK", labelEn: "Facebook" },
    { key: "SMS", labelEn: "SMS Text Message" },
    { key: "PHONE", labelEn: "Phone Call" },
    { key: "OTHER", labelEn: "Other Direct Consent" },
  ]);

  useEffect(() => {
    const next = serializeReviewsUrlState(searchParams, { searchQuery, activeTab, currentPage });
    if (next.toString() !== searchParams.toString()) router.replace(`?${next.toString()}`, { scroll: false });
  }, [activeTab, currentPage, router, searchParams, searchQuery]);

  useEffect(() => {
    void getAdminOrderSources().then((sources) => { if (sources) setSources(sources); });

    fetch("/api/admin/reviews/visibility")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.data === "boolean") setMasterVisible(d.data);
      })
      .catch(() => {});
  }, []);

  async function updateReview(reviewId: string, patch: Record<string, unknown>) {
    setMessage("");
    setErrorMsg("");
    setBusyReviewId(reviewId);
    const res = await fetch("/api/admin/reviews", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: reviewId, ...patch }),
    });
    const body = await res.json();
    setBusyReviewId(null);
    if (!res.ok) {
      setErrorMsg(body.message || body.code || "Review action failed");
      return false;
    }
    setRows((current) => current.map((item) => (item.id === reviewId ? body.data : item)));
    setMessage("Review updated successfully.");
    setEditingDisplayTextId(null);
    setReplyingId(null);
    setRejectingId(null);
    return true;
  }

  async function handleDeleteReview(reviewId: string) {
    setMessage("");
    setErrorMsg("");
    setBusyReviewId(reviewId);
    const res = await fetch(`/api/admin/reviews?id=${encodeURIComponent(reviewId)}`, {
      method: "DELETE",
    });
    const body = await res.json();
    setBusyReviewId(null);
    if (!res.ok) {
      setErrorMsg(body.message || body.code || "Failed to delete review");
      return;
    }
    setRows((current) => current.filter((r) => r.id !== reviewId));
    setDeletingReview(null);
    setMessage("Review deleted permanently.");
  }

  async function confirmApproval() {
    if (!approvingReview) return;
    const updated = await updateReview(approvingReview.id, { status: "APPROVED" });
    if (updated) setApprovingReview(null);
  }

  async function submitManualImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMsg("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const displayName = (form.get("displayName") as string)?.trim();
    const rating = Number(form.get("rating"));
    const originalText = (form.get("originalText") as string)?.trim();
    const orderId = (form.get("orderId") as string)?.trim() || undefined;
    const verifiedBuyer = form.get("verifiedBuyer") === "on";
    const isAnonymous = form.get("isAnonymous") === "on";
    const source = (form.get("acknowledgementSource") as string)?.trim() || undefined;
    const publicationConsentNote = (form.get("publicationConsentNote") as string)?.trim() || undefined;

    if (verifiedBuyer && (!orderId || !orderId.trim())) {
      setErrorMsg("Order Reference, Phone, Facebook Profile, or Email proof is required when marking as Verified Buyer.");
      return;
    }

    const res = await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName,
        reviewerName: displayName,
        isAnonymous,
        rating,
        originalText,
        orderId,
        verifiedBuyer,
        acknowledgementSource: source,
        publicationConsentNote,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErrorMsg(body.message || body.code || "Failed to import review");
      return;
    }
    setRows((current) => [body.data, ...current]);
    setActiveTab("pending");
    setCurrentPage(1);
    setSearchQuery("");
    setShowManualModal(false);
    setModalAnonymousChecked(false);
    setMessage("Manual review imported successfully.");
    formElement.reset();
  }

  // Calculate Metrics
  const totalApproved = rows.filter((r) => r.status === "APPROVED");
  const pendingTriage = rows.filter((r) => r.status === "PENDING" || r.status === "PENDING_CONFIRMATION");
  const featuredReviews = rows.filter((r) => r.featured && r.status === "APPROVED");
  const rejectedReviews = rows.filter((r) => r.status === "REJECTED");

  // Filtered & Searched Rows for active tab
  const filteredRows = rows.filter((r) => {
    let matchesTab = true;
    if (activeTab === "pending") matchesTab = r.status === "PENDING" || r.status === "PENDING_CONFIRMATION";
    else if (activeTab === "approved") matchesTab = r.status === "APPROVED";
    else if (activeTab === "featured") matchesTab = r.featured && r.status === "APPROVED";
    else if (activeTab === "rejected") matchesTab = r.status === "REJECTED";

    if (!matchesTab) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const text = `${r.reviewerName ?? r.displayName} ${r.contact ?? ""} ${r.orderId ?? ""} ${r.originalText} ${r.displayText ?? ""}`.toLowerCase();
      return text.includes(q);
    }

    return true;
  });

  const paginatedRows = serverTotal === null ? filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : filteredRows;

  return (
    <main className="admin-reviews-workspace shell py-8 space-y-6">
      {loading && <AdminNotice tone="success" live>Loading reviews…</AdminNotice>}
      <div className="reviews-page-heading">
        <AdminPageHeader
          eyebrow="Content and trust"
          title="Review moderation"
          description={`${pendingTriage.length} awaiting decision · Verify consent and publication identity before publishing.`}
        />
        <div className="reviews-page-actions">
          <div className="reviews-storefront-state">
            {masterVisible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            <span>{masterVisible ? "Reviews visible" : "Reviews hidden"}</span>
            <Link href="/admin/settings" className="text-primary hover:underline">Settings</Link>
          </div>
          {canCreate && <button type="button" className="btn btn-secondary" onClick={() => setShowManualModal(true)}><Plus aria-hidden="true" />Import review</button>}
        </div>
      </div>

      {message && <AdminNotice tone="success">{message}</AdminNotice>}
      {errorMsg && <AdminNotice tone="error">{errorMsg}</AdminNotice>}

      <div className="card review-queue">
        <div className="review-filter-bar">
          <div className="review-state-tabs" role="tablist" aria-label="Review moderation views">
            {[
              { id: "pending", label: "Pending", count: pendingTriage.length },
              { id: "approved", label: "Approved", count: totalApproved.length },
              { id: "featured", label: "Featured", count: featuredReviews.length },
              { id: "rejected", label: "Rejected", count: rejectedReviews.length },
              { id: "all", label: "All", count: rows.length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? "is-active" : ""}
                onClick={() => {
                  setActiveTab(tab.id as ReviewTab);
                  setCurrentPage(1);
                }}
              >
                <span>{tab.label}</span><b>{tab.count}</b>
              </button>
            ))}
          </div>

          <AdminSearchField wrapperClassName="review-search"
              placeholder="Search reviewer, order, or review text"
              aria-label="Search reviews"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
          />
        </div>

        {filteredRows.length === 0 ? (
          <AdminEmptyState
            title={activeTab === "pending" && !searchQuery ? "Pending queue is clear" : "No reviews match this view"}
            description={activeTab === "pending" && !searchQuery ? "Every submitted review has a moderation decision. Continue with Approved or All reviews." : "Clear the search or choose another saved view."}
          />
        ) : (
          <div className="review-record-list">
            {paginatedRows.map((review) => (
              <article
                key={review.id}
                className={`review-record ${
                  review.featured ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
                }`}
              >
                {/* Review Header Card */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{review.reviewerName || review.displayName}</span>

                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${review.isAnonymous ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                        {review.isAnonymous ? "Anonymous publication" : "Named publication"}
                      </span>

                      {/* Verified Buyer Badge */}
                      {review.verifiedBuyer ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 aria-hidden="true" />Verified buyer
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Unverified Guest
                        </span>
                      )}

                      {/* Source Badge */}
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        {review.acknowledgementSource || review.source}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                          review.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : review.status === "REJECTED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {review.status}
                      </span>

                      {review.featured && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-white">
                          <Star aria-hidden="true" />Featured
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Submitted: {new Date(review.createdAt).toLocaleDateString("fi-FI")}</span>
                      {review.contact && <span>Contact: {maskContact(review.contact)}</span>}
                      {review.orderId && <span>Order: #{review.orderId.substring(0, 8)}</span>}
                      <span className={review.publicationAcknowledgement ? "review-consent-ok" : "review-consent-missing"}>
                        {review.publicationAcknowledgement ? <><ShieldCheck aria-hidden="true" />Publication consent recorded</> : <><Ban aria-hidden="true" />Consent evidence missing</>}
                      </span>
                    </div>
                  </div>

                  {/* Rating Stars & Action Menu */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center text-amber-500 font-bold text-sm">
                      {"★".repeat(review.rating)}
                      <span className="text-slate-300">{"★".repeat(5 - review.rating)}</span>
                    </div>

                      {/* AdminRowActionMenu with Kebab ⋮ Icon */}
                    <AdminRowActionMenu
                      items={[
                        ...(canModerate
                          ? [
                              {
                                id: "edit",
                                label: "Edit Review",
                                icon: <IconPencil className="w-4 h-4 text-blue-600" />,
                                onClick: () => setEditingReview(review),
                              },
                              {
                                id: "publication-identity",
                                label: review.isAnonymous ? "Publish reviewer name" : "Make reviewer anonymous",
                                icon: review.isAnonymous
                                  ? <IconUser className="w-4 h-4 text-blue-600" />
                                  : <IconLock className="w-4 h-4 text-violet-600" />,
                                onClick: () => setIdentityReview(review),
                              },
                              {
                                id: "link",
                                label: "Link Order / Identity",
                                icon: <IconLink className="w-4 h-4 text-emerald-600" />,
                                onClick: () => setLinkingReview(review),
                              },
                            ]
                          : []),
                        ...(canModerate && review.status !== "APPROVED"
                          ? [
                              {
                                id: "approve",
                                label: "Approve Review",
                                icon: <CheckCircle2 className="text-emerald-700" aria-hidden="true" />,
                                disabled: !review.publicationAcknowledgement,
                                onClick: () => setApprovingReview(review),
                              },
                            ]
                          : []),
                        ...(review.status === "APPROVED" && canFeature
                          ? [
                              {
                                id: "feature",
                                label: review.featured ? "Unfeature from Homepage" : "Feature on Homepage",
                                icon: <Star className="text-amber-600" aria-hidden="true" />,
                                onClick: () =>
                                  void updateReview(review.id, {
                                    featured: !review.featured,
                                    featuredUntil: !review.featured ? new Date(Date.now() + 90 * 86400000).toISOString() : undefined,
                                  }),
                              },
                            ]
                          : []),
                        ...(canModerate
                          ? [
                              {
                                id: "reply",
                                label: review.sellerReplyText ? "Edit Seller Reply" : "Reply to Customer",
                                icon: <MessageSquare className="text-blue-700" aria-hidden="true" />,
                                onClick: () => {
                                  setReplyingId(replyingId === review.id ? null : review.id);
                                  setDraftReplyText(review.sellerReplyText || "");
                                },
                              },
                            ]
                          : []),
                        ...(canModerate && review.status !== "REJECTED"
                          ? [
                              {
                                id: "reject",
                                label: "Reject Review",
                                icon: <Ban className="text-rose-700" aria-hidden="true" />,
                                onClick: () => setRejectingId(review.id),
                              },
                            ]
                          : []),
                        ...(canModerate
                          ? [
                              {
                                id: "delete",
                                label: "Delete Review Permanently",
                                icon: <IconTrash className="w-4 h-4 text-rose-600" />,
                                danger: true,
                                onClick: () => setDeletingReview(review),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </div>

                {/* Review Text Display */}
                <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 font-medium">
                    <span>Original Customer Quote:</span>
                    {canModerate && <button
                      type="button"
                      className="text-primary hover:underline font-semibold"
                      onClick={() => {
                        setEditingDisplayTextId(review.id);
                        setDraftDisplayText(review.displayText || review.originalText);
                      }}
                    >
                      {review.displayText ? "Edit storefront text" : "Add storefront text"}
                    </button>}
                  </div>
                  <p className="text-slate-800 italic font-medium">&quot;{review.originalText}&quot;</p>

                  {editingDisplayTextId === review.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        className="w-full text-sm border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        value={draftDisplayText}
                        onChange={(e) => setDraftDisplayText(e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary text-xs px-3 py-1"
                          onClick={() => void updateReview(review.id, { displayText: draftDisplayText })}
                        >
                          Save Display Text
                        </button>
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:underline"
                          onClick={() => setEditingDisplayTextId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-900 font-medium mt-1">
                      {review.displayText ? `"${review.displayText}"` : <span className="text-slate-400 italic">(Using original text)</span>}
                    </p>
                  )}
                </div>

                {/* Seller Reply Section */}
                {review.sellerReplyText && (
                  <div className="bg-emerald-50/60 p-3.5 rounded border border-emerald-200 text-sm space-y-1">
                    <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <MessageSquare aria-hidden="true" />Store reply:
                      {review.sellerRepliedAt && (
                        <span className="text-slate-500 font-normal text-xs">
                          ({new Date(review.sellerRepliedAt).toLocaleDateString("fi-FI")})
                        </span>
                      )}
                    </p>
                    <p className="text-emerald-950 font-medium italic">&quot;{review.sellerReplyText}&quot;</p>
                  </div>
                )}

                {replyingId === review.id && (
                  <div className="bg-slate-100 p-3.5 rounded border border-slate-300 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Write Public Seller Reply</label>
                    <textarea
                      className="w-full text-sm border border-slate-300 rounded p-2"
                      rows={2}
                      placeholder="Lämmin kiitos palautteesta..."
                      value={draftReplyText}
                      onChange={(e) => setDraftReplyText(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn text-xs px-3 py-1 bg-emerald-600 text-white"
                        onClick={() => void updateReview(review.id, { sellerReplyText: draftReplyText })}
                      >
                        Post Seller Reply
                      </button>
                      <button
                        type="button"
                        className="text-xs text-slate-500 hover:underline"
                        onClick={() => setReplyingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Rejection Prompt */}
                {rejectingId === review.id && (
                  <div className="review-rejection-panel">
                    <span className="text-xs font-bold text-rose-900">Reason for rejection:</span>
                    <select
                      className="text-xs border border-rose-300 rounded p-1"
                      value={rejectionReason}
                       onChange={(e) => setRejectionReason(e.target.value as RejectionReason)}
                    >
                      <option value="SPAM">Spam / Bot</option>
                      <option value="PROFANITY">Profanity / Abuse</option>
                      <option value="UNRELATED">Unrelated Content</option>
                      <option value="COMPETITOR">Competitor Malice</option>
                      <option value="OTHER">Other Reason</option>
                    </select>
                    <button
                      type="button"
                      className="btn bg-rose-600 text-white text-xs px-2.5 py-1 font-bold"
                      onClick={() => void updateReview(review.id, { status: "REJECTED", rejectionReason })}
                      disabled={busyReviewId === review.id}
                    >
                      {busyReviewId === review.id ? "Saving…" : "Confirm rejection"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-500 hover:underline"
                      onClick={() => setRejectingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {canModerate && (review.status === "PENDING" || review.status === "PENDING_CONFIRMATION") && (
                  <footer className="review-decision-bar">
                    <span>{review.publicationAcknowledgement ? "Consent evidence is recorded." : "Record publication consent before approval."}</span>
                    <div>
                      <button type="button" className="btn btn-secondary" onClick={() => setRejectingId(review.id)}><Ban aria-hidden="true" />Reject</button>
                      <button type="button" className="btn" disabled={!review.publicationAcknowledgement || busyReviewId === review.id} onClick={() => setApprovingReview(review)}><CheckCircle2 aria-hidden="true" />Review approval</button>
                    </div>
                  </footer>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {serverTotal !== null && serverTotal > 0 && <AdminPagination
        page={currentPage}
        limit={pageSize}
        total={serverTotal}
        onPageChange={setCurrentPage}
        onLimitChange={(newLimit) => setPageSize(newLimit)}
        itemLabel="reviews"
      />}

      {approvingReview && <AdminConfirmDialog open title="Approve this review?" description="Approval publishes this review according to the selected identity when storefront reviews are visible." confirmLabel="Approve and publish" onCancel={() => setApprovingReview(null)} onConfirm={confirmApproval}>
            <dl>
              <div><dt>Identity</dt><dd>{approvingReview.isAnonymous ? "Anonymous publication" : approvingReview.reviewerName || approvingReview.displayName}</dd></div>
              <div><dt>Consent</dt><dd>{approvingReview.publicationAcknowledgement ? `Recorded${approvingReview.acknowledgementSource ? ` via ${approvingReview.acknowledgementSource}` : ""}` : "Missing"}</dd></div>
              <div><dt>Verification</dt><dd>{approvingReview.verifiedBuyer ? `Verified · ${approvingReview.verificationType}` : "Unverified"}</dd></div>
              <div><dt>Storefront text</dt><dd>&quot;{approvingReview.displayText || approvingReview.originalText}&quot;</dd></div>
            </dl>
            <AdminNotice tone="warning">Publication requires recorded customer acknowledgement.</AdminNotice>
      </AdminConfirmDialog>}

      {deletingReview && <AdminConfirmDialog open title="Delete review permanently?" description={`This permanently removes the review by ${deletingReview.reviewerName || deletingReview.displayName}. Use rejection or hiding when moderation history should remain available.`} confirmLabel="Delete permanently" destructive onCancel={() => setDeletingReview(null)} onConfirm={async () => { await handleDeleteReview(deletingReview.id); }} />}

      {/* Manual Import Modal */}
      {showManualModal && (
        <div className="admin-dialog-backdrop">
          <div ref={manualReviewDialogRef} className="admin-dialog card manual-review-dialog space-y-4 animate-in fade-in zoom-in-95" role="dialog" aria-modal="true" aria-label="Import review">
            <div className="manual-review-dialog-header flex items-center justify-between gap-4 border-b border-line">
              <div>
                <span className="eyebrow">Offline feedback</span>
                <h2 className="text-base font-bold text-ink">Manual review import</h2>
              </div>
              <button
                type="button"
                className="text-ink/60 hover:text-ink font-bold text-lg p-1"
                onClick={() => setShowManualModal(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 text-xs font-bold rounded-xl bg-rose-100 text-rose-900 border border-rose-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={(e) => void submitManualImport(e)} className="space-y-4">
              <label className="field text-xs">
                <span className="font-semibold text-ink">Reviewer Name</span>
                <input
                  name="displayName"
                  required
                  minLength={2}
                  className="text-xs"
                  placeholder="e.g. Maija Virtanen"
                />
                <small>
                  {modalAnonymousChecked ? "Kept private and visible only to staff." : "Published with the review."}
                </small>
              </label>

              <label className="field-checkbox manual-review-choice text-xs">
                <input
                  name="isAnonymous"
                  type="checkbox"
                  checked={modalAnonymousChecked}
                  onChange={(e) => setModalAnonymousChecked(e.target.checked)}
                />
                <span>
                  <strong>Anonymous publication</strong>
                  <small>Hide the reviewer name on the storefront while retaining it for staff.</small>
                </span>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="field text-xs">
                  <span className="font-semibold text-ink">Rating</span>
                  <select name="rating" required defaultValue="5" className="text-xs font-bold">
                    <option value="5">5 — Excellent</option>
                    <option value="4">4 — Very good</option>
                    <option value="3">3 — Good</option>
                    <option value="2">2 — Fair</option>
                    <option value="1">1 — Poor</option>
                  </select>
                </label>

                <label className="field text-xs">
                  <span className="font-semibold text-ink">Consent Source</span>
                  <select name="acknowledgementSource" required defaultValue={sources[0]?.key ?? "WHATSAPP"} className="text-xs font-bold">
                    {sources.map((src) => (
                      <option key={src.key} value={src.key}>
                        {src.labelEn || src.key}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field text-xs">
                <span className="font-semibold text-ink">
                  Order Ref / Facebook / Phone
                </span>
                <input
                  name="orderId"
                  required={modalVerifiedChecked}
                  className="text-xs"
                  placeholder="e.g. H-A1B2C, 0401234567, fb/username"
                />
              </label>

              <label className="field text-xs">
                <span className="font-semibold text-ink">Publication Consent Note</span>
                <textarea
                  name="publicationConsentNote"
                  required
                  minLength={2}
                  maxLength={500}
                  rows={2}
                  className="text-xs"
                  placeholder="Record how the reviewer approved this publication identity choice."
                />
              </label>

              <label className="field text-xs">
                <span className="font-semibold text-ink">Customer Feedback Quote</span>
                <textarea
                  name="originalText"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={3}
                  className="manual-review-quote text-xs"
                  placeholder="Kiitos mahtavista marjoista! Toriparkin nouto sujui loistavasti..."
                />
              </label>

              <label className="field-checkbox manual-review-choice text-xs">
                <input
                  name="verifiedBuyer"
                  type="checkbox"
                  checked={modalVerifiedChecked}
                  onChange={(e) => setModalVerifiedChecked(e.target.checked)}
                />
                <span>
                  <strong>Verified buyer</strong>
                  <small>Requires an order reference or contact proof.</small>
                </span>
              </label>

              <div className="manual-review-actions">
                <button
                  type="button"
                  className="btn btn-secondary text-xs font-semibold py-2 px-4"
                  onClick={() => setShowManualModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn text-xs font-bold py-2 px-4 shadow-xs">
                  Import review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Review Modal */}
      {editingReview && (
        <EditReviewModal
          review={editingReview}
          onClose={() => setEditingReview(null)}
          onSaved={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setEditingReview(null);
            setMessage("Review updated successfully.");
          }}
        />
      )}

      {identityReview && (
        <PublicationIdentityModal
          review={identityReview}
          sources={sources}
          onClose={() => setIdentityReview(null)}
          onSaved={(updated) => {
            setRows((current) => current.map((review) => (review.id === updated.id ? updated : review)));
            setIdentityReview(null);
            setMessage(updated.isAnonymous
              ? "Reviewer identity is now private."
              : "Reviewer name recorded. Review returned to Pending Triage.");
          }}
        />
      )}

      {/* Link Identity Modal */}
      {linkingReview && (
        <LinkIdentityModal
          review={linkingReview}
          onClose={() => setLinkingReview(null)}
          onLinked={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setMessage("Review successfully linked to customer/order and verified.");
          }}
        />
      )}
    </main>
  );
}
