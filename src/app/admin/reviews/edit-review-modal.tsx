"use client";

import { useState, type FormEvent } from "react";

export type ReviewItem = {
  id: string;
  displayName: string;
  contact: string | null;
  rating: number;
  originalText: string;
  displayText: string | null;
  source: "PUBLIC_FORM" | "MANUAL_IMPORT";
  acknowledgementSource: string | null;
  verifiedBuyer: boolean;
  orderId: string | null;
};

export function EditReviewModal({
  review,
  onClose,
  onSaved,
}: {
  review: ReviewItem;
  onClose: () => void;
  onSaved: (updated: any) => void;
}) {
  const [displayName, setDisplayName] = useState(review.displayName);
  const [rating, setRating] = useState(review.rating);
  const [source, setSource] = useState<string>(review.acknowledgementSource || review.source || "WHATSAPP");
  const [originalText, setOriginalText] = useState(review.originalText);
  const [displayText, setDisplayText] = useState(review.displayText || "");
  const [orderId, setOrderId] = useState(review.orderId || "");
  const [verifiedBuyer, setVerifiedBuyer] = useState(review.verifiedBuyer);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || displayName.trim().length < 2) {
      return setErrorMsg("Customer Display Name must be at least 2 characters.");
    }
    if (!originalText.trim() || originalText.trim().length < 10) {
      return setErrorMsg("Original Feedback Text must be at least 10 characters.");
    }
    if (verifiedBuyer && !orderId.trim()) {
      return setErrorMsg("Order Reference, Phone, Facebook Profile, or Email proof is required when marking as Verified Buyer.");
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: review.id,
          displayName: displayName.trim(),
          rating,
          acknowledgementSource: source,
          originalText: originalText.trim(),
          displayText: displayText.trim() || undefined,
          orderId: orderId.trim() || undefined,
          verifiedBuyer,
        }),
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
            <span className="font-semibold text-ink">Customer Name *</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="text-xs"
              placeholder="e.g. Matti M."
            />
          </label>

          <label className="field">
            <span className="font-semibold text-ink">Star Rating (1–5) *</span>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="field">
            <span className="font-semibold text-ink">Feedback Source Channel</span>
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
            <span className="font-semibold text-ink">
              Order Ref / Facebook / Phone {verifiedBuyer && <span className="text-rose-600 font-bold">*</span>}
            </span>
            <input
              type="text"
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
          <span className="font-semibold text-ink">Original Feedback Text *</span>
          <textarea
            rows={3}
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            required
            className="text-xs"
          />
        </label>

        <label className="field text-xs">
          <span className="font-semibold text-ink">Storefront Display Text (Optional Edited Copy)</span>
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
            className="btn text-xs font-bold py-2 px-4 shadow-xs"
          >
            {loading ? "⏳ Saving Changes..." : "💾 Save Audit Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
