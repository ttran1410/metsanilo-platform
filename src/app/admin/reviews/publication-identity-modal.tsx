"use client";

import { useState, type FormEvent } from "react";
import type { ReviewItem } from "./edit-review-modal";
import { useAdminDialogFocus } from "../presentation";

export function PublicationIdentityModal({
  review,
  sources,
  onClose,
  onSaved,
}: {
  review: ReviewItem;
  sources: Array<{ key: string; labelEn: string }>;
  onClose: () => void;
  onSaved: (updated: ReviewItem) => void;
}) {
  const dialogRef = useAdminDialogFocus<HTMLFormElement>(true, onClose);
  const makeAnonymous = !(review.isAnonymous ?? false);
  const [reviewerName, setReviewerName] = useState(review.reviewerName || (review.isAnonymous ? "" : review.displayName));
  const [consentSource, setConsentSource] = useState(review.acknowledgementSource || sources[0]?.key || "OTHER");
  const [consentNote, setConsentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!makeAnonymous && reviewerName.trim().length < 2) {
      setError("Enter the reviewer name that they approved for publication.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: review.id,
          action: "publication_identity",
          isAnonymous: makeAnonymous,
          reviewerName: reviewerName.trim() || undefined,
          consentSource,
          consentNote: consentNote.trim(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Failed to update publication identity");
      onSaved(body.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update publication identity");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-dialog-backdrop">
      <form ref={dialogRef} className="admin-dialog card space-y-4 p-6" role="dialog" aria-modal="true" aria-label="Publication identity" onSubmit={(event) => void handleSubmit(event)}>
        <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
          <div>
            <span className="eyebrow">PUBLICATION IDENTITY</span>
            <h2 className="text-base font-bold text-ink">
              {makeAnonymous ? "Make reviewer anonymous" : "Publish reviewer name"}
            </h2>
          </div>
          <button type="button" className="text-ink/60 hover:text-ink font-bold text-lg p-1" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={`rounded-lg border p-3 text-xs leading-relaxed ${makeAnonymous ? "border-violet-200 bg-violet-50 text-violet-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {makeAnonymous
            ? "The reviewer name will be hidden from the storefront immediately. Staff will continue to see the private identity."
            : "The reviewer name will become public after moderation. This review will move to Pending Triage and be removed from the storefront until approved again."}
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800" role="alert">
            {error}
          </div>
        ) : null}

        {!makeAnonymous ? (
          <label className="field text-xs">
            <span>Public reviewer name</span>
            <input required minLength={2} maxLength={80} value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} />
          </label>
        ) : (
          <div className="rounded-lg border border-line bg-slate-50 p-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Private reviewer identity</span>
            <strong className="mt-1 block text-sm text-slate-900">{reviewerName || "Not provided"}</strong>
          </div>
        )}

        <label className="field text-xs">
          <span>Consent source</span>
          <select required value={consentSource} onChange={(event) => setConsentSource(event.target.value)}>
            {sources.map((source) => (
              <option key={source.key} value={source.key}>{source.labelEn || source.key}</option>
            ))}
          </select>
        </label>

        <label className="field text-xs">
          <span>Consent note</span>
          <textarea
            required
            minLength={2}
            maxLength={500}
            rows={3}
            value={consentNote}
            onChange={(event) => setConsentNote(event.target.value)}
            placeholder="Record how the reviewer confirmed this identity change."
          />
        </label>

        <div className="flex items-center justify-end gap-3 border-t border-line pt-3">
          <button type="button" className="btn btn-secondary text-xs font-semibold" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn text-xs font-bold" disabled={submitting}>
            {submitting ? "Saving..." : makeAnonymous ? "Make anonymous" : "Send to moderation"}
          </button>
        </div>
      </form>
    </div>
  );
}
