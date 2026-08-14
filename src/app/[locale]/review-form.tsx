"use client";

import { useState } from "react";
import type { Locale } from "@/lib/format";

const labels = {
  fi: { name: "Nimi / nimimerkki *", namePlaceholder: "esim. Liisa K.", rating: "Arvio *", review: "Arvostelu *", reviewPlaceholder: "Kerro marjoista ja palvelusta…", submit: "Lähetä arvostelu", moderation: "Arvostelut tarkistetaan ennen julkaisua.", success: "Kiitos palautteestasi! Arvostelu odottaa tarkistusta." },
  en: { name: "Name / nickname *", namePlaceholder: "e.g. Liisa K.", rating: "Rating *", review: "Review *", reviewPlaceholder: "Tell us about the berries and service…", submit: "Submit review", moderation: "Reviews are moderated before public display.", success: "Thank you for your feedback! Your review is waiting for moderation." },
} satisfies Record<Locale, Record<string, string>>;

export function ReviewForm({ locale }: { locale: Locale }) {
  const t = labels[locale];
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  return <form className="review-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
    <div className="review-form-field"><label htmlFor="review-name">{t.name}</label><input id="review-name" name="name" required placeholder={t.namePlaceholder} onChange={() => setSubmitted(false)} /></div>
    <fieldset className="review-rating-field"><legend>{t.rating}</legend><div className="review-rating-options">{[1, 2, 3, 4, 5].map((value) => <label key={value} className={rating >= value ? "selected" : ""}><input type="radio" name="rating" value={value} required checked={rating === value} onChange={() => { setRating(value); setSubmitted(false); }} /><span aria-hidden="true">★</span><span className="sr-only">{value} {locale === "fi" ? "tähteä" : "stars"}</span></label>)}</div></fieldset>
    <div className="review-form-field"><label htmlFor="review-text">{t.review}</label><textarea id="review-text" name="review" required minLength={10} maxLength={1000} rows={5} placeholder={t.reviewPlaceholder} onChange={() => setSubmitted(false)} /></div>
    <p className="review-form-note">{t.moderation}</p><button className="btn btn-accent" type="submit">{t.submit}<span aria-hidden="true">→</span></button>{submitted && <p className="review-form-success" role="status">{t.success}</p>}
  </form>;
}
