"use client";

import { useEffect, useState } from "react";
import { AdminNotice, AdminPageHeader } from "../presentation";

type Review = {
  id: string;
  displayName: string;
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
  const [rows, setRows] = useState<Review[]>(initial);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "featured" | "rejected" | "all">("pending");
  const [masterVisible, setMasterVisible] = useState(true);
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingDisplayTextId, setEditingDisplayTextId] = useState<string | null>(null);
  const [draftDisplayText, setDraftDisplayText] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [draftReplyText, setDraftReplyText] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<"SPAM" | "PROFANITY" | "UNRELATED" | "COMPETITOR" | "OTHER">("SPAM");

  useEffect(() => {
    fetch("/api/admin/reviews/visibility")
      .then((res) => res.json())
      .then((body) => {
        if (body.data?.visible !== undefined) setMasterVisible(body.data.visible);
      })
      .catch(() => {});
  }, []);

  async function toggleMasterVisibility() {
    const next = !masterVisible;
    const res = await fetch("/api/admin/reviews/visibility", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visible: next }),
    });
    const body = await res.json();
    if (res.ok) {
      setMasterVisible(body.data.visible);
      setMessage(`Storefront reviews are now ${body.data.visible ? "PUBLIC (ON)" : "HIDDEN (OFF)"}`);
    } else {
      setErrorMsg(body.message || "Could not toggle reviews visibility");
    }
  }

  async function updateReview(
    reviewId: string,
    patch: {
      status?: "APPROVED" | "REJECTED" | "HIDDEN" | "ARCHIVED";
      displayText?: string;
      reason?: string;
      rejectionReason?: "SPAM" | "PROFANITY" | "UNRELATED" | "COMPETITOR" | "OTHER";
      featured?: boolean;
      featuredUntil?: string;
      verifiedBuyer?: boolean;
      sellerReplyText?: string;
    },
  ) {
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

  async function confirmManual(reviewId: string, source: "SMS" | "WHATSAPP" | "PHONE" | "OTHER") {
    setMessage("");
    setErrorMsg("");
    const res = await fetch("/api/admin/reviews", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: reviewId, confirmSource: source }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErrorMsg(body.message || body.code || "Confirmation failed");
      return;
    }
    setRows((current) => current.map((item) => (item.id === reviewId ? body.data : item)));
    setMessage(`Publication consent confirmed via ${source}.`);
  }

  async function submitManualImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMsg("");
    const form = new FormData(event.currentTarget);
    const displayName = (form.get("displayName") as string)?.trim();
    const rating = Number(form.get("rating"));
    const originalText = (form.get("originalText") as string)?.trim();
    const orderId = (form.get("orderId") as string)?.trim() || undefined;
    const verifiedBuyer = form.get("verifiedBuyer") === "on";
    const source = form.get("acknowledgementSource") as "SMS" | "WHATSAPP" | "PHONE" | "OTHER";

    const res = await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName,
        rating,
        originalText,
        orderId,
        verifiedBuyer,
        acknowledgementSource: source,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErrorMsg(body.message || body.code || "Failed to import review");
      return;
    }
    setRows((current) => [body.data, ...current]);
    setShowManualModal(false);
    setMessage("Manual review imported successfully.");
    event.currentTarget.reset();
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

  // Filtered Rows for active tab
  const filteredRows = rows.filter((r) => {
    if (activeTab === "pending") return r.status === "PENDING" || r.status === "PENDING_CONFIRMATION";
    if (activeTab === "approved") return r.status === "APPROVED";
    if (activeTab === "featured") return r.featured && r.status === "APPROVED";
    if (activeTab === "rejected") return r.status === "REJECTED";
    return true;
  });

  return (
    <main className="shell py-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <AdminPageHeader
          eyebrow="CONTENT & TRUST"
          title="Review Moderation Hub"
          description="High-velocity review triage, dual-text auditing, and storefront highlights."
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`btn text-xs font-semibold px-4 py-2 flex items-center gap-2 ${
              masterVisible ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-rose-600 text-white hover:bg-rose-700"
            }`}
            onClick={() => void toggleMasterVisibility()}
          >
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            Master Storefront Switch: {masterVisible ? "PUBLIC REVIEWS ON" : "STOREFRONT REVIEWS OFF"}
          </button>
          {canCreate && (
            <button
              type="button"
              className="btn btn-secondary text-xs font-semibold px-4 py-2"
              onClick={() => setShowManualModal(true)}
            >
              ➕ Manual Feedback Import
            </button>
          )}
        </div>
      </div>

      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {errorMsg && <AdminNotice tone="error" live>{errorMsg}</AdminNotice>}

      {/* Summary Metrics Banner */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card bg-amber-50/50 border-amber-200/60 p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-900/70">Published Trust Metric</p>
            <p className="mt-1 text-3xl font-extrabold text-amber-900 flex items-center gap-2">
              ⭐️ {avgRating} <span className="text-lg font-normal text-amber-700">/ 5.0</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-amber-800 font-medium">
            Based on {totalCount} approved reviews ({fiveStarPercent}% 5-Star)
          </p>
        </div>

        <div className="card bg-blue-50/50 border-blue-200/60 p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-900/70">Pending Moderation</p>
            <p className="mt-1 text-3xl font-extrabold text-blue-950 flex items-center gap-2">
              📬 {pendingTriage.length} <span className="text-lg font-normal text-blue-700">Inbox</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-blue-800 font-medium">
            {pendingTriage.length > 0 ? "Requires staff triage action" : "All customer submissions are moderated!"}
          </p>
        </div>

        <div className="card p-5 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Star Distribution</p>
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const cnt = starCounts[star];
            const pct = totalCount > 0 ? (cnt / totalCount) * 100 : 0;
            return (
              <div key={star} className="flex items-center text-xs gap-2">
                <span className="w-6 font-semibold text-slate-700">{star}★</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right font-mono text-slate-500">{cnt}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
            activeTab === "pending" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
          onClick={() => setActiveTab("pending")}
        >
          📬 Inbox / Pending ({pendingTriage.length})
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
            activeTab === "approved" ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
          onClick={() => setActiveTab("approved")}
        >
          🟢 Approved ({totalApproved.length})
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
            activeTab === "featured" ? "bg-amber-500 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
          onClick={() => setActiveTab("featured")}
        >
          ⭐ Featured ({featuredReviews.length})
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
            activeTab === "rejected" ? "bg-rose-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
          onClick={() => setActiveTab("rejected")}
        >
          🚫 Rejected ({rejectedReviews.length})
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
            activeTab === "all" ? "bg-slate-800 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
          onClick={() => setActiveTab("all")}
        >
          All Reviews ({rows.length})
        </button>
      </div>

      {/* Moderation Queue */}
      <div className="space-y-4">
        {filteredRows.length === 0 && (
          <div className="card p-8 text-center text-slate-500">
            No reviews found in this tab.
          </div>
        )}

        {filteredRows.map((review) => (
          <article key={review.id} className="card p-6 space-y-4 border border-slate-200/80 shadow-sm relative">
            {/* Header / Badges */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-amber-500 text-lg">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                  <span className="font-bold text-slate-900 text-base">{review.displayName}</span>

                  {/* Verification Badges */}
                  {review.verifiedBuyer ? (
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      ✓ Vahvistettu tilaus {review.orderId ? `#${review.orderId.substring(0, 8)}` : ""}
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded">
                      Julkinen arvostelu
                    </span>
                  )}

                  {review.publicationAcknowledgement ? (
                    <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded border border-blue-200">
                      ✓ GDPR Consent Verified ({review.acknowledgementSource || "Web"})
                    </span>
                  ) : (
                    <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded">
                      ⚠️ Consent Confirmation Missing
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mt-1">
                  Submitted {new Date(review.createdAt).toLocaleString("fi-FI")} • Source:{" "}
                  <span className="font-medium">{review.source}</span>
                  {review.contact && ` • Contact: ${review.contact}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {review.featured && (
                  <span className="bg-amber-100 text-amber-800 font-semibold text-xs px-2.5 py-1 rounded-full border border-amber-300 flex items-center gap-1">
                    ⭐ Featured on Homepage
                  </span>
                )}
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wider ${
                    review.status === "APPROVED"
                      ? "bg-emerald-100 text-emerald-800"
                      : review.status === "REJECTED"
                      ? "bg-rose-100 text-rose-800"
                      : review.status === "HIDDEN"
                      ? "bg-slate-200 text-slate-700"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {review.status}
                </span>
              </div>
            </div>

            {/* Review Content & Dual-Text Audit */}
            <div className="grid gap-4 md:grid-cols-2 bg-slate-50/70 p-4 rounded-lg border border-slate-100">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Original Review (Immutable Audit)</p>
                <p className="text-sm text-slate-800 mt-1 italic">"{review.originalText}"</p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Storefront Display Text (Sanitized)</p>
                  {canModerate && editingDisplayTextId !== review.id && (
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline font-semibold"
                      onClick={() => {
                        setEditingDisplayTextId(review.id);
                        setDraftDisplayText(review.displayText || review.originalText);
                      }}
                    >
                      ✏️ Edit Display Text
                    </button>
                  )}
                </div>

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
                        onClick={() =>
                          void updateReview(review.id, { displayText: draftDisplayText })
                        }
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
                <p className="text-emerald-950 font-medium italic">"{review.sellerReplyText}"</p>
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

            {/* Action Bar */}
            {canModerate && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  {!review.publicationAcknowledgement && review.source === "MANUAL_IMPORT" && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-600">Confirm consent:</span>
                      {(["WHATSAPP", "SMS", "PHONE"] as const).map((src) => (
                        <button
                          key={src}
                          type="button"
                          className="btn btn-secondary text-xs px-2.5 py-1"
                          onClick={() => void confirmManual(review.id, src)}
                        >
                          {src}
                        </button>
                      ))}
                    </div>
                  )}

                  {review.status !== "APPROVED" && (
                    <button
                      type="button"
                      className="btn text-xs px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
                      onClick={() => void updateReview(review.id, { status: "APPROVED" })}
                    >
                      🟢 APPROVE
                    </button>
                  )}

                  {review.status === "APPROVED" && canFeature && (
                    <button
                      type="button"
                      className={`btn text-xs px-3 py-1.5 font-semibold ${
                        review.featured ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-amber-500 text-white hover:bg-amber-600"
                      }`}
                      onClick={() =>
                        void updateReview(review.id, {
                          featured: !review.featured,
                          featuredUntil: !review.featured ? new Date(Date.now() + 90 * 86400000).toISOString() : undefined,
                        })
                      }
                    >
                      {review.featured ? "⭐ Remove Feature" : "⭐ FEATURE ON HOMEPAGE"}
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary text-xs px-3 py-1.5"
                    onClick={() => {
                      setReplyingId(replyingId === review.id ? null : review.id);
                      setDraftReplyText(review.sellerReplyText || "");
                    }}
                  >
                    💬 {review.sellerReplyText ? "Edit Seller Reply" : "Reply"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary text-xs px-3 py-1.5"
                    onClick={() =>
                      void updateReview(review.id, { verifiedBuyer: !review.verifiedBuyer })
                    }
                  >
                    {review.verifiedBuyer ? "Unmark Verified" : "✓ Mark Verified Buyer"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {rejectingId === review.id ? (
                    <div className="flex items-center gap-2 bg-rose-50 p-1.5 rounded border border-rose-200">
                      <select
                        className="text-xs border border-rose-300 rounded p-1"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value as any)}
                      >
                        <option value="SPAM">Spam / Bot</option>
                        <option value="PROFANITY">Profanity / Abuse</option>
                        <option value="UNRELATED">Unrelated Content</option>
                        <option value="COMPETITOR">Competitor Malice</option>
                        <option value="OTHER">Other Reason</option>
                      </select>
                      <button
                        type="button"
                        className="btn bg-rose-600 text-white text-xs px-2 py-1"
                        onClick={() =>
                          void updateReview(review.id, { status: "REJECTED", rejectionReason })
                        }
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
                  ) : (
                    review.status !== "REJECTED" && (
                      <button
                        type="button"
                        className="btn btn-danger text-xs px-3 py-1.5"
                        onClick={() => setRejectingId(review.id)}
                      >
                        🚫 REJECT
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Manual Import Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">➕ Manual Feedback Import (WhatsApp / SMS)</h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 font-bold"
                onClick={() => setShowManualModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void submitManualImport(e)} className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Reviewer Display Name *
                <input
                  name="displayName"
                  required
                  minLength={2}
                  className="mt-1 block w-full rounded border-slate-300 p-2 text-sm"
                  placeholder="Maija Virtanen"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-medium text-slate-700">
                  Rating *
                  <select name="rating" defaultValue="5" className="mt-1 block w-full rounded border-slate-300 p-2 text-sm">
                    <option value="5">⭐⭐⭐⭐⭐ (5/5)</option>
                    <option value="4">⭐⭐⭐⭐ (4/5)</option>
                    <option value="3">⭐⭐⭐ (3/5)</option>
                    <option value="2">⭐⭐ (2/5)</option>
                    <option value="1">⭐ (1/5)</option>
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Consent Source *
                  <select name="acknowledgementSource" defaultValue="WHATSAPP" className="mt-1 block w-full rounded border-slate-300 p-2 text-sm">
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SMS">SMS Text Message</option>
                    <option value="PHONE">Phone Call</option>
                    <option value="OTHER">Other Direct Consent</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Order Reference / Phone (Optional)
                <input
                  name="orderId"
                  className="mt-1 block w-full rounded border-slate-300 p-2 text-sm"
                  placeholder="e.g. H-A1B2C, 040 123 4567, or leave blank"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Customer Feedback Quote *
                <textarea
                  name="originalText"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={3}
                  className="mt-1 block w-full rounded border-slate-300 p-2 text-sm"
                  placeholder="Kiitos mahtavista marjoista! Toriparkin nouto sujui loistavasti..."
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input name="verifiedBuyer" type="checkbox" defaultChecked className="rounded text-emerald-600" />
                Mark as Verified Buyer (Historical match / verified customer)
              </label>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  className="btn btn-secondary text-sm px-4 py-2"
                  onClick={() => setShowManualModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn bg-emerald-600 text-white text-sm px-4 py-2 font-semibold">
                  Import Review & Log Consent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
