"use client";

import React, { useState } from "react";
import { PenLine, Rocket, CheckCircle2, X } from "lucide-react";
import type { Locale } from "@/lib/format";

export function ReviewModal({
  locale,
  isOpen,
  onClose,
  onSuccess,
}: {
  locale: Locale;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [displayName, setDisplayName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [crmConsent, setCrmConsent] = useState(false);
  const [contact, setContact] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [consent, setConsent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  if (!isOpen) return null;

  const copy = {
    fi: {
      title: "Jaa kokemuksesi",
      subtitle: "Auta muita Satakunnan marjaystäviä kuulemaan kokemuksestasi.",
      step1: "1. Valitse tähtiluokitus",
      step2: "2. Nimesi / Nimimerkki (Julkaistaan)",
      step3: "3. Puhelin tai tilausnumero (Vahvistusta varten, ei julkaista)",
      step4: "4. Kokemuksesi",
      step5: "5. Julkaisulupa (GDPR)",
      consentText: "Annan luvan julkaista arvosteluni Metsänilon verkkosivustolla.",
      anonymous: "Julkaise arvostelu anonyymisti",
      crmConsent: "Saan käyttää yhteystietojani asiakasrekisterissä.",
      placeholderName: "Maija V. / Pori",
      placeholderContact: "040 123 4567 tai R-9102",
      placeholderReview: "Kerro marjojen laadusta, noudosta tai toimituksesta...",
      cancel: "Peruuta",
      submit: "Lähetä arvostelu",
      submitting: "Lähetetään...",
      successTitle: "Kiitos arvostelustasi!",
      successBody: "Palautteesi on lähetetty ja julkaistaan henkilökunnan tarkistuksen jälkeen.",
      close: "Sulje",
      ratingLabels: ["", "Heikko", "Välttävä", "Kohtalainen", "Hyvä!", "Erinomainen!"],
      submitError: "Arvostelun lähettäminen epäonnistui. Yritä uudelleen.",
    },
    en: {
      title: "Share Your Experience",
      subtitle: "Help other berry lovers hear about your experience.",
      step1: "1. Select Rating",
      step2: "2. Your Name / Nickname (Public)",
      step3: "3. Phone or Order Ref (For verification, kept private)",
      step4: "4. Your Review",
      step5: "5. Publication Consent (GDPR)",
      consentText: "I agree to have my review published on Metsänilo website.",
      anonymous: "Publish this review anonymously",
      crmConsent: "I consent to my contact details being used in the customer register.",
      placeholderName: "Maija V. / Pori",
      placeholderContact: "040 123 4567 or R-9102",
      placeholderReview: "Tell us about the quality of berries, pickup, or delivery...",
      cancel: "Cancel",
      submit: "Submit Review",
      submitting: "Submitting...",
      successTitle: "Thank you for your review!",
      successBody: "Your feedback has been received and will be displayed after moderation.",
      close: "Close",
      ratingLabels: ["", "Poor", "Fair", "Average", "Good!", "Excellent!"],
      submitError: "Could not submit your review. Please try again.",
    },
  }[locale];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!consent) {
      setErrorMsg(locale === "fi" ? "Hyväksy julkaisulupa jatkaaksesi." : "Please check publication consent.");
      return;
    }
    if (!isAnonymous && displayName.trim().length < 2) {
      setErrorMsg(locale === "fi" ? "Syötä vähintään 2 merkkiä nimeen." : "Name must be at least 2 characters.");
      return;
    }
    if (reviewText.trim().length < 10) {
      setErrorMsg(locale === "fi" ? "Arvostelutekstin tulee olla vähintään 10 merkkiä." : "Review text must be at least 10 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/public/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          isAnonymous,
          crmConsent,
          rating,
          reviewText: reviewText.trim(),
          contact: contact.trim() || undefined,
          publicationAcknowledgement: true,
          locale,
        }),
      });

      await res.json();
      if (!res.ok) throw new Error(copy.submitError);

      setSubmittedSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : copy.submitError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--store-surface)] text-[var(--store-ink)] border border-[var(--store-line)] rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 relative animate-in fade-in zoom-in-95">
        <button
          type="button"
          className="absolute top-4 right-4 text-[var(--store-muted)] hover:text-[var(--store-ink)] p-1 rounded-full hover:bg-[var(--store-surface-muted)] transition-colors cursor-pointer"
          onClick={onClose}
          aria-label={copy.close}
        >
          <X className="w-5 h-5" />
        </button>

        {submittedSuccess ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[var(--store-primary-soft)] text-[var(--forest)] mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-[var(--store-ink)]">{copy.successTitle}</h2>
            <p className="text-sm muted max-w-xs mx-auto">{copy.successBody}</p>
            <button
              type="button"
              className="btn btn-accent text-white font-semibold text-sm px-6 py-2 rounded-full mt-4"
              onClick={onClose}
            >
              {copy.close}
            </button>
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center gap-2">
                <PenLine className="w-5 h-5 text-[var(--forest)]" />
                <h2 className="text-xl font-extrabold text-[var(--store-ink)]">{copy.title}</h2>
              </div>
              <p className="text-xs muted mt-1">{copy.subtitle}</p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {/* Star Rating Selection */}
              <div>
                <label className="block text-xs font-bold text-[var(--store-ink)] mb-1.5">
                  {copy.step1}
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`text-2xl transition-transform ${
                        rating >= star ? "scale-110 text-amber-500" : "text-slate-300 hover:text-amber-400"
                      }`}
                      onClick={() => setRating(star)}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-xs font-bold text-[var(--store-ink)] ml-2">
                     {rating}/5 ({copy.ratingLabels[rating]})
                  </span>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--store-ink)]">
                  {copy.step2}
                </label>
                <input
                  type="text"
                  required={!isAnonymous}
                  minLength={isAnonymous ? undefined : 2}
                  maxLength={80}
                  className="w-full text-sm border border-[var(--store-line)] bg-[var(--store-surface)] rounded-xl p-3 text-[var(--store-ink)] focus:outline-none focus:border-[var(--store-focus)] focus:ring-1 focus:ring-[var(--store-focus)] transition-all"
                  placeholder={copy.placeholderName}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <label className="flex items-center gap-2.5 text-xs text-[var(--store-ink)] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--forest)] cursor-pointer"
                  />
                  <span>{copy.anonymous}</span>
                </label>
              </div>

              {/* Phone / Reference */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--store-ink)]">
                  {copy.step3}
                </label>
                <input
                  type="text"
                  className="w-full text-sm border border-[var(--store-line)] bg-[var(--store-surface)] rounded-xl p-3 text-[var(--store-ink)] focus:outline-none focus:border-[var(--store-focus)] focus:ring-1 focus:ring-[var(--store-focus)] transition-all"
                  placeholder={copy.placeholderContact}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>

              {/* Review Text */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--store-ink)]">
                  {copy.step4}
                </label>
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  className="w-full text-sm border border-[var(--store-line)] bg-[var(--store-surface)] rounded-xl p-3 text-[var(--store-ink)] focus:outline-none focus:border-[var(--store-focus)] focus:ring-1 focus:ring-[var(--store-focus)] transition-all leading-relaxed"
                  placeholder={copy.placeholderReview}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                />
              </div>

              {/* Consent Checkboxes */}
              <div className="space-y-2.5 pt-1">
                <label className="flex items-start gap-2.5 text-xs text-[var(--store-ink)] cursor-pointer leading-snug">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded accent-[var(--forest)] flex-shrink-0 cursor-pointer"
                  />
                  <span className="font-semibold">{copy.consentText}</span>
                </label>
                <label className="flex items-start gap-2.5 text-xs text-[var(--store-ink)] cursor-pointer leading-snug">
                  <input
                    type="checkbox"
                    checked={crmConsent}
                    onChange={(e) => setCrmConsent(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded accent-[var(--forest)] flex-shrink-0 cursor-pointer"
                  />
                  <span>{copy.crmConsent}</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--store-line)]">
                <button
                  type="button"
                  className="btn btn-secondary text-xs font-bold px-5 py-2.5 rounded-full"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  {copy.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-accent text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  {isSubmitting ? copy.submitting : copy.submit}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
