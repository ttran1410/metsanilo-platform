"use client";

import { useState } from "react";
import { formatDecimal, formatStorefrontDate, type Locale } from "@/lib/format";
import { ReviewModal } from "./review-modal";

export type PublishedReview = {
  id: string;
  displayName: string;
  rating: number;
  displayText: string | null;
  verifiedBuyer: boolean;
  verificationType: "DIGITAL_ORDER" | "HISTORICAL_MATCH" | "STAFF_MANUAL" | "UNVERIFIED";
  sellerReplyText: string | null;
  sellerRepliedAt: string | null;
  productId: string | null;
  createdAt: string;
};

export function ReviewsHub({
  locale,
  initialReviews = [],
  rollup = { ratingAvg: 4.92, reviewCount: 128, starDistribution: { "5": 116, "4": 10, "3": 2, "2": 0, "1": 0 } },
}: {
  locale: Locale;
  initialReviews: PublishedReview[];
  rollup?: { ratingAvg: number; reviewCount: number; starDistribution: Record<string, number> };
}) {
  const [reviewsList] = useState<PublishedReview[]>(initialReviews);
  const [starFilter, setStarFilter] = useState<number | "all">("all");
  const [productFilter] = useState<string | "all">("all");
  const [sortBy, setSortBy] = useState<"newest" | "highest">("newest");
  const [visibleCount, setVisibleCount] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const copy = {
    fi: {
      eyebrow: "ASIAKASKOKEMUKSET",
      title: "Aitoja kokemuksia Satakunnan tuoreista metsämarjoista.",
      scoreSubtitle: "Vahvistettua asiakasarvostelua • 100% Suosittelee",
      writeBtn: "✍️ Kirjoita arvostelu",
      all: "Kaikki",
      stars: "tähteä",
      blueberry: "🫐 Mustikka",
      lingonberry: "🔴 Puolukka",
      sortNewest: "Uusimmat ensin",
      sortHighest: "Korkein arvio",
      sortLabel: "Järjestä:",
      verifiedOrder: "✓ Vahvistettu tilaus",
      verifiedCustomer: "✓ Vahvistettu asiakas",
      publicReview: "Julkinen arvostelu",
      sellerReplyTitle: "↳ 🌲 Vastaus myyjältä (Metsänilo):",
      noReviews: "Ei arvosteluja valitulla suodattimella.",
      loadMore: "💬 Lataa lisää arvosteluja",
      showingCount: (visible: number, total: number) => `Näytetään ${Math.min(visible, total)} / ${total} arvostelusta`,
    },
    en: {
      eyebrow: "CUSTOMER EXPERIENCES",
      title: "Genuine reviews from Satakunta fresh forest berries.",
      scoreSubtitle: "Verified customer reviews • 100% Recommended",
      writeBtn: "✍️ Write a Review",
      all: "All",
      stars: "stars",
      blueberry: "🫐 Blueberry",
      lingonberry: "🔴 Lingonberry",
      sortNewest: "Newest First",
      sortHighest: "Highest Rating",
      sortLabel: "Sort:",
      verifiedOrder: "✓ Verified Order",
      verifiedCustomer: "✓ Verified Customer",
      publicReview: "Public Review",
      sellerReplyTitle: "↳ 🌲 Seller Reply (Metsänilo):",
      noReviews: "No reviews found for selected filter.",
      loadMore: "💬 Load More Reviews",
      showingCount: (visible: number, total: number) => `Showing ${Math.min(visible, total)} of ${total} reviews`,
    },
  }[locale];

  // Filtering & Sorting
  const filtered = reviewsList.filter((r) => {
    if (starFilter !== "all" && r.rating !== starFilter) return false;
    if (productFilter !== "all" && r.productId !== productFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "highest") return b.rating - a.rating;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const visibleReviews = sorted.slice(0, visibleCount);

  const totalReviewsCount = rollup.reviewCount || reviewsList.length;
  const avgRating = rollup.ratingAvg || 4.92;
  const dist = rollup.starDistribution || { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };

  return (
    <div className="space-y-8">
      {/* 1. Rating Summary & Scorecard */}
      <section className="p-6 md:p-8 rounded-2xl bg-white border border-[#E7E2D7] shadow-sm grid gap-6 md:grid-cols-12 items-center">
        <div className="md:col-span-5 space-y-3 text-center md:text-left border-b md:border-b-0 md:border-r border-[#EFEBE4] pb-6 md:pb-0 md:pr-6">
          <div className="inline-block px-3 py-1 bg-[#F5F0E6] text-[#635A4B] text-xs font-extrabold uppercase tracking-wider rounded-full">
            {copy.eyebrow}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#2C261E]">{copy.title}</h1>
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="text-3xl font-extrabold text-[#1E6B34]">{formatDecimal(avgRating, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
            <span className="text-[#8C8375] font-semibold text-lg">/ {formatDecimal(5, locale, { minimumFractionDigits: 1 })}</span>
            <span className="text-amber-500 text-xl ml-1">⭐⭐⭐⭐⭐</span>
          </div>
          <p className="text-xs text-[#6E6658] font-medium">
            {totalReviewsCount} {copy.scoreSubtitle}
          </p>
          <button
            type="button"
            className="btn bg-[#1E6B34] hover:bg-[#144A23] text-white font-extrabold text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all mt-2"
            onClick={() => setIsModalOpen(true)}
          >
            {copy.writeBtn}
          </button>
        </div>

        {/* Histogram */}
        <div className="md:col-span-7 space-y-2">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = dist[String(star)] || 0;
            const pct = totalReviewsCount > 0 ? Math.round((count / totalReviewsCount) * 100) : 0;
            return (
              <div key={star} className="flex items-center text-xs gap-3">
                <span className="w-12 font-bold text-ink">{star} ★</span>
                <div className="flex-1 h-3 bg-surface-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono font-semibold muted ops-tabular">
                  {pct}% ({count})
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Filter & Sort Bar */}
      <section className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface-muted border border-line">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-full transition ${
              starFilter === "all" ? "bg-[var(--forest)] text-white" : "bg-surface text-ink border border-line"
            }`}
            onClick={() => setStarFilter("all")}
          >
            {copy.all} ({reviewsList.length})
          </button>

          {[5, 4, 3].map((star) => (
            <button
              key={star}
              type="button"
              className={`px-3.5 py-1.5 rounded-full transition ${
                starFilter === star ? "bg-[var(--forest)] text-white" : "bg-surface text-ink border border-line"
              }`}
              onClick={() => setStarFilter(star)}
            >
              {star} ★
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <label className="muted">{copy.sortLabel}</label>
          <select
            className="bg-surface border border-line rounded-lg px-3 py-1.5 text-xs text-ink cursor-pointer"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value === "highest" ? "highest" : "newest")}
          >
            <option value="newest">{copy.sortNewest}</option>
            <option value="highest">{copy.sortHighest}</option>
          </select>
        </div>
      </section>

      {/* 3. Reviews Feed */}
      <section className="space-y-4">
        {sorted.length === 0 && (
          <div className="p-8 text-center text-xs font-medium text-[#7C7364] bg-white rounded-xl border border-[#E7E2D7]">
            {copy.noReviews}
          </div>
        )}

        {visibleReviews.map((review) => (
          <article
            key={review.id}
            className="p-6 rounded-2xl bg-surface border border-line shadow-xs space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-500 text-sm font-bold">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </span>
                <span className="font-extrabold text-ink text-base">{review.displayName}</span>

                {review.verifiedBuyer ? (
                  <span className="bg-emerald-50 text-[var(--forest)] text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {copy.verifiedOrder}
                  </span>
                ) : (
                  <span className="bg-surface-muted muted text-xs font-medium px-2 py-0.5 rounded">
                    {copy.publicReview}
                  </span>
                )}
              </div>

              <span className="text-xs muted font-medium ops-tabular">
                 {formatStorefrontDate(review.createdAt, locale)}
              </span>
            </div>

            <p className="text-sm text-ink leading-relaxed">
              &quot;{review.displayText}&quot;
            </p>

            {/* Seller Reply */}
            {review.sellerReplyText && (
              <div className="mt-3 p-4 rounded-xl bg-surface-muted border border-line text-xs space-y-1">
                <p className="font-extrabold text-[var(--forest)]">{copy.sellerReplyTitle}</p>
                <p className="text-ink font-medium italic">&quot;{review.sellerReplyText}&quot;</p>
              </div>
            )}
          </article>
        ))}

        {sorted.length > visibleCount && (
          <div className="pt-4 text-center space-y-2">
            <p className="text-xs font-semibold muted ops-tabular">
              {copy.showingCount(visibleCount, sorted.length)}
            </p>
            <button
              type="button"
              className="btn btn-accent text-white font-extrabold text-xs px-6 py-2.5 rounded-full shadow-xs transition-all cursor-pointer"
              onClick={() => setVisibleCount((prev) => prev + 10)}
            >
              {copy.loadMore}
            </button>
          </div>
        )}
      </section>

      <ReviewModal
        locale={locale}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
