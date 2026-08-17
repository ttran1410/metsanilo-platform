"use client";

import Link from "next/link";
import type { Locale } from "@/lib/format";

export type FeaturedReviewItem = {
  id: string;
  displayName: string;
  rating: number;
  displayText: string | null;
  originalText: string;
  verifiedBuyer?: boolean;
  orderId?: string | null;
};

export function HighlightReviews({
  locale,
  reviews = [],
  ratingAvg = 4.92,
  reviewCount = 128,
}: {
  locale: Locale;
  reviews: FeaturedReviewItem[];
  ratingAvg?: number;
  reviewCount?: number;
}) {
  if (!reviews || reviews.length === 0) return null;

  const copy = {
    fi: {
      eyebrow: "🌲 MITÄ ASIAKKAAMME SANOVAT",
      heading: "Aitoja asiakaskokemuksia Satakunnasta",
      score: `${ratingAvg.toFixed(1)} / 5.0 Tyytyväisyys`,
      countNote: `${reviewCount}+ Vahvistettua satakuntalaista varausta`,
      verifiedBadge: "✓ Vahvistettu tilaus",
      readAll: "💬 Lue kaikki arvostelut",
    },
    en: {
      eyebrow: "🌲 WHAT OUR CUSTOMERS SAY",
      heading: "Real customer experiences from Satakunta",
      score: `${ratingAvg.toFixed(1)} / 5.0 Rating`,
      countNote: `${reviewCount}+ Verified Satakunta reservations`,
      verifiedBadge: "✓ Verified Order",
      readAll: "💬 Read all reviews",
    },
  }[locale];

  return (
    <section className="shell py-10 md:py-14 my-4">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 mb-8 border-b border-[#E4ECE6]">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#1E6B34]">{copy.eyebrow}</p>
          <h2 className="text-2xl md:text-3xl font-serif font-semibold text-[#1B3626] mt-1 tracking-tight">{copy.heading}</h2>
        </div>

        <div className="inline-flex items-center gap-2.5 bg-[#edf8ef] border border-[#a8d6b8] px-4 py-2 rounded-full text-xs font-bold text-[#1B3626] shadow-xs">
          <span className="text-amber-500 text-sm">★★★★★</span>
          <span className="font-extrabold">{copy.score}</span>
          <span className="text-[#a8d6b8]">·</span>
          <span className="text-[#274d39]">{copy.countNote}</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {reviews.slice(0, 3).map((review) => (
          <article
            key={review.id}
            className="p-6 rounded-2xl bg-white border border-[#E4ECE6] shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-amber-500 text-sm">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </div>
                <span className="text-2xl text-[#a8d6b8] leading-none select-none font-serif font-bold">“</span>
              </div>
              <p className="text-[1.025rem] text-[#24362b] leading-relaxed">
                "{review.displayText || review.originalText}"
              </p>
            </div>

            <div className="mt-6 pt-3.5 border-t border-[#EAF0EC] flex items-center justify-between text-xs">
              <span className="font-bold text-[#1B3626]">— {review.displayName}</span>
              <span className="bg-[#edf8ef] text-[#1E6B34] font-bold px-2.5 py-1 rounded-full border border-[#a8d6b8] text-[0.75rem]">
                {copy.verifiedBadge}
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          href={`/${locale}/reviews`}
          className="btn btn-secondary rounded-full px-6 py-2.5 text-sm font-extrabold gap-2 inline-flex items-center shadow-xs hover:shadow-sm"
        >
          {copy.readAll} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
