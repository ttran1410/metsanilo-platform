"use client";

import { useState, type FormEvent } from "react";
import { useAdminDialogFocus } from "../../presentation";

export type ReviewItem = {
  id: string;
  displayName: string;
  reviewerName?: string | null;
  isAnonymous?: boolean;
  contact: string | null;
  rating: number;
  originalText: string;
  displayText: string | null;
  source: "PUBLIC_FORM" | "MANUAL_IMPORT";
  acknowledgementSource: string | null;
  verifiedBuyer: boolean;
  orderId: string | null;
  status: "PENDING" | "PENDING_CONFIRMATION" | "APPROVED" | "REJECTED" | "HIDDEN" | "ARCHIVED";
  publicationAcknowledgement: boolean;
  acknowledgedAt: string | null;
  verificationType: "DIGITAL_ORDER" | "HISTORICAL_MATCH" | "STAFF_MANUAL" | "UNVERIFIED";
  featured: boolean;
  featuredUntil: string | null;
  moderationReason: string | null;
  rejectionReason: string | null;
  sellerReplyText: string | null;
  sellerRepliedAt: string | null;
  createdAt: string;
};

export function EditReviewModal({
  review,
  onClose,
  onSaved,
}: {
  review: ReviewItem;
  onClose: () => void;
  onSaved: (updated: ReviewItem) => void;
}) {
  const dialogRef = useAdminDialogFocus<HTMLFormElement>(true, onClose);
  const initialReviewerName = review.reviewerName || (review.isAnonymous ? "" : review.displayName);
  const [displayName, setDisplayName] = useState(initialReviewerName);
  const [isAnonymous, setIsAnonymous] = useState(review.isAnonymous ?? false);
  const [consentNote, setConsentNote] = useState("");
  const [rating, setRating] = useState(review.rating);
  const [source, setSource] = useState<string>(review.acknowledgementSource || review.source || "WHATSAPP");
  const [originalText, setOriginalText] = useState(review.originalText);
  const [displayText, setDisplayText] = useState(review.displayText || "");
  const [orderId, setOrderId] = useState(review.orderId || "");
  const [verifiedBuyer, setVerifiedBuyer] = useState(review.verifiedBuyer);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const identityChanged = isAnonymous !== (review.isAnonymous ?? false) || displayName.trim() !== initialReviewerName;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isAnonymous && (!displayName.trim() || displayName.trim().length < 2)) {
      return setErrorMsg("Customer Display Name must be at least 2 characters.");
    }
    if (!originalText.trim() || originalText.trim().length < 10) {
      return setErrorMsg("Original Feedback Text must be at least 10 characters.");
    }
    if (verifiedBuyer && !orderId.trim()) {
      return setErrorMsg("Order Reference, Phone, Facebook Profile, or Email proof is required when marking as Verified Buyer.");
    }
    if (identityChanged && consentNote.trim().length < 2) {
      return setErrorMsg("Record a consent note when changing the publication identity or reviewer name.");
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const payload: Record<string, unknown> = {
        id: review.id,
        rating,
        acknowledgementSource: source,
        originalText: originalText.trim(),
        displayText: displayText.trim(),
        orderId: orderId.trim(),
        verifiedBuyer,
      };
      if (displayName.trim()) payload.displayName = displayName.trim();
      if (identityChanged) {
        payload.action = "publication_identity";
        payload.isAnonymous = isAnonymous;
        payload.reviewerName = displayName.trim() || undefined;
        payload.consentSource = source;
        payload.consentNote = consentNote.trim();
      }

      const res = await fetch("/api/admin/reviews", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to update review");

      onSaved(body.data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-dialog-backdrop">
      <form
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-label="Edit review"
        className="admin-dialog card space-y-4 max-w-xl w-full p-6 animate-in fade-in zoom-in-95"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <span className="eyebrow">REVIEW AUDIT & MODERATION</span>
            <h2 className="text-base font-bold text-ink">✏️ Edit Customer Review</h2>
          </div>
          <button
            type="button"
            className="text-ink/60 hover:text-ink font-bold text-lg p-1"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 text-xs font-bold rounded-xl bg-rose-100 text-rose-900 border border-rose-300">
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="field">
            <span>Reviewer Name {isAnonymous ? "(Private)" : "(Public)"}</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required={!isAnonymous}
              className="text-xs"
              placeholder="e.g. Matti M."
            />
          </label>

          <label className="field">
            <span>Star Rating (1–5)</span>
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="text-xs font-bold"
            >
              <option value={5}>⭐⭐⭐⭐⭐ (5 Stars - Excellent)</option>
              <option value={4}>⭐⭐⭐⭐ (4 Stars - Good)</option>
              <option value={3}>⭐⭐⭐ (3 Stars - Average)</option>
              <option value={2}>⭐⭐ (2 Stars - Poor)</option>
              <option value={1}>⭐ (1 Star - Bad)</option>
            </select>
          </label>
        </div>

        <label className="field-checkbox text-xs">
          <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
          <span className="font-semibold">Publish anonymously (identity remains private to staff)</span>
        </label>
        {identityChanged ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">
              {isAnonymous
                ? "The public name will be hidden immediately. Staff will retain the private identity."
                : "Publishing a name requires reviewer consent and sends the review back to moderation."}
            </p>
            <label className="field text-xs">
              <span>Publication consent note</span>
              <textarea required minLength={2} rows={2} value={consentNote} onChange={(e) => setConsentNote(e.target.value)} placeholder="Record how the reviewer confirmed this identity change." className="text-xs" />
            </label>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="field">
            <span>Feedback Source Channel</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="text-xs font-bold"
            >
              <option value="WHATSAPP">💬 WhatsApp Message</option>
              <option value="FACEBOOK">📘 Facebook Page / DM</option>
              <option value="SMS">✉️ SMS Text Message</option>
              <option value="PHONE">📞 Phone Call</option>
              <option value="PUBLIC_FORM">🌐 Public Website Form</option>
              <option value="OTHER">📋 Other Direct Consent</option>
            </select>
          </label>

          <label className="field">
            <span>
              Order Ref / Facebook / Phone
            </span>
            <input
              type="text"
              required={verifiedBuyer}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="text-xs"
              placeholder="e.g. H-A1B2C, 0401234567, fb/username"
            />
          </label>
        </div>

        <label className="field-checkbox text-xs">
          <input
            type="checkbox"
            checked={verifiedBuyer}
            onChange={(e) => setVerifiedBuyer(e.target.checked)}
          />
          <span className="font-semibold">Mark as Verified Buyer (Requires Order Ref or Contact Proof)</span>
        </label>

        <label className="field text-xs">
          <span>Original Feedback Text</span>
          <textarea
            rows={3}
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            required
            className="text-xs"
          />
        </label>

        <label className="field text-xs">
          <span>Storefront Display Text (Optional Edited Copy)</span>
          <textarea
            rows={2}
            value={displayText}
            onChange={(e) => setDisplayText(e.target.value)}
            placeholder="Leave blank to use original text on storefront."
            className="text-xs"
          />
        </label>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
          <button
            type="button"
            className="btn btn-secondary text-xs font-semibold py-2 px-4"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn text-xs font-semibold py-2 px-4 shadow-xs"
          >
            {loading ? "Saving changes…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
