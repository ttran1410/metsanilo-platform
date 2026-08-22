"use client";

import { useState } from "react";
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
      title: "✍️ Jaa kokemuksesi",
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
      submit: "🚀 Lähetä arvostelu",
      submitting: "Lähetetään...",
      successTitle: "Kiitos arvostelustasi!",
      successBody: "Palautteesi on lähetetty ja julkaistaan henkilökunnan tarkistuksen jälkeen.",
      close: "Sulje",
      ratingLabels: ["", "Heikko", "Välttävä", "Kohtalainen", "Hyvä!", "Erinomainen!"],
      submitError: "Arvostelun lähettäminen epäonnistui. Yritä uudelleen.",
    },
    en: {
      title: "✍️ Share Your Experience",
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
      submit: "🚀 Submit Review",
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 relative animate-in fade-in zoom-in-95">
        <button
          type="button"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-lg"
          onClick={onClose}
        >
          ✕
        </button>

        {submittedSuccess ? (
          <div className="py-6 text-center space-y-3">
            <span className="text-4xl">🎉</span>
            <h2 className="text-xl font-extrabold text-slate-900">{copy.successTitle}</h2>
            <p className="text-sm text-slate-600 max-w-xs mx-auto">{copy.successBody}</p>
            <button
              type="button"
              className="btn bg-emerald-700 text-white font-semibold text-sm px-6 py-2 rounded-xl mt-4"
              onClick={onClose}
            >
              {copy.close}
            </button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{copy.title}</h2>
              <p className="text-xs text-slate-500 mt-1">{copy.subtitle}</p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
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
                  <span className="text-xs font-bold text-slate-700 ml-2">
                     {rating}/5 ({copy.ratingLabels[rating]})
                  </span>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {copy.step2}
                </label>
                <input
                  type="text"
                   required={!isAnonymous}
                   minLength={isAnonymous ? undefined : 2}
                  maxLength={80}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                  placeholder={copy.placeholderName}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
                  {copy.anonymous}
                </label>
              </div>

              {/* Phone / Reference */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {copy.step3}
                </label>
                <input
                  type="text"
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                  placeholder={copy.placeholderContact}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>

              {/* Review Text */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {copy.step4}
                </label>
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                  placeholder={copy.placeholderReview}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                />
              </div>

              {/* Consent Checkbox */}
              <label className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600"
                />
                <span>{copy.consentText}</span>
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={crmConsent}
                  onChange={(e) => setCrmConsent(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600"
                />
                <span>{copy.crmConsent}</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  className="btn btn-secondary text-sm px-4 py-2"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  {copy.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-all"
                >
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
