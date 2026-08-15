"use client";

import { useState } from "react";
import type { Locale } from "@/lib/format";
import { CustomerFieldError, customerValidationCopy, focusFirstCustomerFieldError } from "./customer-form-validation";
import { validateReviewFields, type ReviewField } from "./review-form-validation";

const labels = {
  fi: { name: "Nimi / nimimerkki *", namePlaceholder: "esim. Liisa K.", rating: "Arvio *", review: "Arvostelu *", reviewPlaceholder: "Kerro marjoista ja palvelusta…", submit: "Lähetä arvostelu", moderation: "Arvostelut tarkistetaan ennen julkaisua.", success: "Kiitos palautteestasi! Arvostelu odottaa tarkistusta." },
  en: { name: "Name / nickname *", namePlaceholder: "e.g. Liisa K.", rating: "Rating *", review: "Review *", reviewPlaceholder: "Tell us about the berries and service…", submit: "Submit review", moderation: "Reviews are moderated before public display.", success: "Thank you for your feedback! Your review is waiting for moderation." },
} satisfies Record<Locale, Record<string, string>>;

export function ReviewForm({ locale }: { locale: Locale }) {
  const t = labels[locale];
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ReviewField, string>>>({});

  function clearFieldError(field: string) {
    if (!(field in fieldErrors)) return;
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field as ReviewField];
      return next;
    });
  }

  function handleChange(event: React.FormEvent<HTMLFormElement>) {
    setSubmitted(false);
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) clearFieldError(target.name);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const nextErrors = validateReviewFields({
      name: String(values.get("name") ?? ""),
      rating,
      review: String(values.get("review") ?? ""),
    }, locale);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitted(false);
      setError(customerValidationCopy[locale].checkHighlighted);
      setFieldErrors(nextErrors);
      focusFirstCustomerFieldError(form, nextErrors);
      return;
    }

    setError(undefined);
    setFieldErrors({});
    setSubmitted(true);
  }

  return <form className="review-form" onSubmit={submit} onChange={handleChange} noValidate>
    <p className="required-note">{customerValidationCopy[locale].requiredNote}</p>
    {error && <div className="error form-error" role="alert" tabIndex={-1}>{error}</div>}
    <div className={`review-form-field${fieldErrors.name ? " field-invalid" : ""}`} data-field="name"><label htmlFor="review-name">{t.name}</label><input id="review-name" name="name" required maxLength={120} placeholder={t.namePlaceholder} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "name-error" : undefined} /><CustomerFieldError field="name" error={fieldErrors.name} /></div>
    <fieldset className={`review-rating-field${fieldErrors.rating ? " field-invalid" : ""}`} data-field="rating" aria-invalid={Boolean(fieldErrors.rating)} aria-describedby={fieldErrors.rating ? "rating-error" : undefined}><legend>{t.rating}</legend><div className="review-rating-options">{[1, 2, 3, 4, 5].map((value) => <label key={value} className={rating >= value ? "selected" : ""}><input type="radio" name="rating" value={value} required checked={rating === value} onChange={() => setRating(value)} aria-describedby={fieldErrors.rating ? "rating-error" : undefined} /><span aria-hidden="true">★</span><span className="sr-only">{value} {locale === "fi" ? "tähteä" : "stars"}</span></label>)}</div><CustomerFieldError field="rating" error={fieldErrors.rating} /></fieldset>
    <div className={`review-form-field${fieldErrors.review ? " field-invalid" : ""}`} data-field="review"><label htmlFor="review-text">{t.review}</label><textarea id="review-text" name="review" required minLength={10} maxLength={1000} rows={5} placeholder={t.reviewPlaceholder} aria-invalid={Boolean(fieldErrors.review)} aria-describedby={fieldErrors.review ? "review-error" : undefined} /><CustomerFieldError field="review" error={fieldErrors.review} /></div>
    <p className="review-form-note">{t.moderation}</p><button className="btn btn-accent" type="submit">{t.submit}<span aria-hidden="true">→</span></button>{submitted && <p className="review-form-success" role="status">{t.success}</p>}
  </form>;
}
