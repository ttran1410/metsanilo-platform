"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { AdminNotice, AdminPageHeader } from "../presentation";
import { AdminPagination } from "../ui/admin-pagination";
import { AdminRowActionMenu, IconLink, IconLock, IconPencil, IconTrash, IconUser } from "../ui/admin-row-action-menu";
import { LinkIdentityModal } from "./link-identity-modal";
import { EditReviewModal } from "./edit-review-modal";
import { PublicationIdentityModal } from "./publication-identity-modal";

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

type ReviewTab = "pending" | "approved" | "featured" | "rejected" | "all";
type RejectionReason = "SPAM" | "PROFANITY" | "UNRELATED" | "COMPETITOR" | "OTHER";

export function ReviewsManager({
  initial,
  canCreate,
  canModerate,
  canFeature,
}: {
  initial: Review[];
  canCreate: boolean;
  canModerate: boolean;
  canFeature: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Review[]>(initial);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<ReviewTab>(() => {
    const tab = searchParams.get("status");
    return tab === "approved" || tab === "featured" || tab === "rejected" || tab === "all" ? tab : "pending";
  });
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "");
  const [currentPage, setCurrentPage] = useState(() => Number(searchParams.get("page") ?? "1") || 1);
  const [pageSize, setPageSize] = useState(20);
  const [masterVisible, setMasterVisible] = useState(true);
  const [showManualModal, setShowManualModal] = useState(false);
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
  const [sources, setSources] = useState<Array<{ key: string; labelEn: string }>>([
    { key: "WHATSAPP", labelEn: "WhatsApp" },
    { key: "FACEBOOK", labelEn: "Facebook" },
    { key: "SMS", labelEn: "SMS Text Message" },
    { key: "PHONE", labelEn: "Phone Call" },
    { key: "OTHER", labelEn: "Other Direct Consent" },
  ]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (searchQuery) next.set("q", searchQuery); else next.delete("q");
    if (activeTab !== "pending") next.set("status", activeTab); else next.delete("status");
    if (currentPage > 1) next.set("page", String(currentPage)); else next.delete("page");
    if (next.toString() !== searchParams.toString()) router.replace(`?${next.toString()}`, { scroll: false });
  }, [activeTab, currentPage, router, searchParams, searchQuery]);

  useEffect(() => {
    fetch("/api/admin/order-sources")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data && Array.isArray(d.data)) setSources(d.data);
      })
      .catch(() => {});

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
    const res = await fetch("/api/admin/reviews", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: reviewId, ...patch }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErrorMsg(body.message || body.code || "Review action failed");
      return;
    }
    setRows((current) => current.map((item) => (item.id === reviewId ? body.data : item)));
    setMessage("Review updated successfully.");
    setEditingDisplayTextId(null);
    setReplyingId(null);
    setRejectingId(null);
  }

  async function handleDeleteReview(reviewId: string) {
    if (!confirm("Are you sure you want to permanently delete this review? This action cannot be undone.")) return;
    setMessage("");
    setErrorMsg("");
    const res = await fetch(`/api/admin/reviews?id=${encodeURIComponent(reviewId)}`, {
      method: "DELETE",
    });
    const body = await res.json();
    if (!res.ok) {
      setErrorMsg(body.message || body.code || "Failed to delete review");
      return;
    }
    setRows((current) => current.filter((r) => r.id !== reviewId));
    setMessage("Review deleted permanently.");
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

  const totalCount = totalApproved.length;
  const ratingSum = totalApproved.reduce((acc, r) => acc + r.rating, 0);
  const avgRating = totalCount > 0 ? (ratingSum / totalCount).toFixed(2) : "5.00";
  const fiveStarPercent = totalCount > 0 ? Math.round((totalApproved.filter((r) => r.rating === 5).length / totalCount) * 100) : 100;

  const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of totalApproved) {
    const star = r.rating as 1 | 2 | 3 | 4 | 5;
    if (starCounts[star] !== undefined) starCounts[star]++;
  }

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

  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <main className="admin-reviews-workspace shell py-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <AdminPageHeader
          eyebrow="CONTENT & TRUST"
          title="Review Moderation Hub"
          description="High-velocity review triage, dual-text auditing, and storefront highlights."
        />
        <div className="flex flex-wrap items-center gap-3">
          {/* Read-Only Storefront Status Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${masterVisible ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            <span>{masterVisible ? "🟢 Public on Storefront" : "⚪ Hidden in Settings"}</span>
            <Link href="/admin/settings" className="text-primary hover:underline font-normal text-[11px] ml-1">
              (Settings)
            </Link>
          </div>

          {canCreate && (
            <button
              type="button"
              className="btn btn-secondary text-xs font-semibold px-4 py-2"
              onClick={() => setShowManualModal(true)}
            >
              Manual feedback import
            </button>
          )}
        </div>
      </div>

      {message && <AdminNotice tone="success">{message}</AdminNotice>}
      {errorMsg && <AdminNotice tone="error">{errorMsg}</AdminNotice>}

      {/* Analytics KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Public Rating Rollup</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-900">{avgRating}</span>
            <span className="text-amber-500 text-lg">★</span>
            <span className="text-xs text-slate-500 font-medium">({totalCount} reviews)</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2">{fiveStarPercent}% 5-star rating score</span>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Moderation</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-3xl font-black ${pendingTriage.length > 0 ? "text-amber-600" : "text-slate-700"}`}>
              {pendingTriage.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">awaiting triage</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2">Requires staff consent check</span>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Homepage Featured</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-emerald-700">{featuredReviews.length}</span>
            <span className="text-xs text-slate-500 font-medium">highlighted cards</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2">Selected for Storefront homepage</span>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Rating Breakdown</span>
          <div className="space-y-1 mt-1 text-[11px]">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="flex items-center gap-2">
                <span className="w-8 font-semibold text-slate-600">{star} ★</span>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full"
                    style={{ width: `${totalCount > 0 ? ((starCounts[star as 1|2|3|4|5] || 0) / totalCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-5 text-right font-medium text-slate-500">{starCounts[star as 1|2|3|4|5] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "pending", label: `Pending Triage (${pendingTriage.length})` },
              { id: "approved", label: `Approved (${totalApproved.length})` },
              { id: "featured", label: `Featured (${featuredReviews.length})` },
              { id: "rejected", label: `Rejected (${rejectedReviews.length})` },
              { id: "all", label: `All Reviews (${rows.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => {
                  setActiveTab(tab.id as ReviewTab);
                  setCurrentPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search reviews by reviewer, contact, or feedback quote…"
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Reviews List Grid */}
        {filteredRows.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm italic">
            No reviews found matching the current tab and filter.
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedRows.map((review) => (
              <article
                key={review.id}
                className={`p-4 rounded-xl border transition-all space-y-3 bg-white ${
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
                          ✓ Verified Buyer
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
                          ⭐ Featured
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Submitted: {new Date(review.createdAt).toLocaleDateString("fi-FI")}</span>
                      {review.contact && <span>Contact: {review.contact}</span>}
                      {review.orderId && <span>Order: #{review.orderId.substring(0, 8)}</span>}
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
                                icon: <span className="text-xs">🟢</span>,
                                onClick: () => void updateReview(review.id, { status: "APPROVED" }),
                              },
                            ]
                          : []),
                        ...(review.status === "APPROVED" && canFeature
                          ? [
                              {
                                id: "feature",
                                label: review.featured ? "Unfeature from Homepage" : "Feature on Homepage",
                                icon: <span className="text-xs">⭐</span>,
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
                                icon: <span className="text-xs">💬</span>,
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
                                icon: <span className="text-xs">🚫</span>,
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
                                onClick: () => void handleDeleteReview(review.id),
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
                    <button
                      type="button"
                      className="text-primary hover:underline font-semibold"
                      onClick={() => {
                        setEditingDisplayTextId(review.id);
                        setDraftDisplayText(review.displayText || review.originalText);
                      }}
                    >
                      {review.displayText ? "Edit Storefront Text" : "+ Custom Storefront Copy"}
                    </button>
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
                      🌲 Seller Reply (Metsänilo):
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
                  <div className="flex items-center gap-2 bg-rose-50 p-2 rounded border border-rose-200">
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
                    >
                      Confirm Reject
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
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <AdminPagination
        page={currentPage}
        limit={pageSize}
        total={filteredRows.length}
        onPageChange={setCurrentPage}
        onLimitChange={(newLimit) => setPageSize(newLimit)}
        itemLabel="reviews"
      />

      {/* Manual Import Modal */}
      {showManualModal && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card manual-review-dialog space-y-4 animate-in fade-in zoom-in-95">
            <div className="manual-review-dialog-header flex items-center justify-between gap-4 border-b border-line">
              <div>
                <span className="eyebrow">OFFLINE FEEDBACK INGESTION</span>
                <h2 className="text-base font-bold text-ink">➕ Manual Feedback Import</h2>
              </div>
              <button
                type="button"
                className="text-ink/60 hover:text-ink font-bold text-lg p-1"
                onClick={() => setShowManualModal(false)}
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 text-xs font-bold rounded-xl bg-rose-100 text-rose-900 border border-rose-300">
                ⚠️ {errorMsg}
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
                    <option value="5">⭐⭐⭐⭐⭐ (5/5)</option>
                    <option value="4">⭐⭐⭐⭐ (4/5)</option>
                    <option value="3">⭐⭐⭐ (3/5)</option>
                    <option value="2">⭐⭐ (2/5)</option>
                    <option value="1">⭐ (1/5)</option>
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
