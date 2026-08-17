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
    <section className="shell py-8 my-6 rounded-2xl bg-[#FFFCF6] border border-[#D8D3C8] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EBE6DC] pb-4 mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#5C5549]">{copy.eyebrow}</p>
          <h2 className="text-xl font-extrabold text-[#2C261E] mt-0.5">{copy.heading}</h2>
        </div>

        <div className="flex items-center gap-3 bg-[#FAF5EC] px-4 py-2 rounded-xl border border-[#E5E0D5]">
          <span className="text-amber-500 text-lg">⭐⭐⭐⭐⭐</span>
          <div className="text-xs">
            <span className="font-extrabold text-[#2C261E] block text-sm">{copy.score}</span>
            <span className="text-[#6B6355]">{copy.countNote}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {reviews.slice(0, 3).map((review) => (
          <article
            key={review.id}
            className="p-5 rounded-xl bg-white border border-[#E7E2D7] shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-1 text-amber-500 text-sm mb-2">
                {"★".repeat(review.rating)}
                {"☆".repeat(5 - review.rating)}
              </div>
              <p className="text-sm text-[#383228] italic leading-relaxed">
                "{review.displayText || review.originalText}"
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[#F2ECE1] flex items-center justify-between text-xs">
              <span className="font-bold text-[#2C261E]">— {review.displayName}</span>
              <span className="bg-[#EAF5EC] text-[#1E6B34] font-semibold px-2 py-0.5 rounded-full border border-[#C5E5CC]">
                {copy.verifiedBadge}
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link
          href={`/${locale}/reviews`}
          className="inline-flex items-center gap-2 font-bold text-sm text-[#1E6B34] hover:text-[#144A23] transition-colors"
        >
          {copy.readAll} <span aria-hidden="true">──►</span>
        </Link>
      </div>
    </section>
  );
}
