"use client";

import { useState } from "react";
import type { Locale } from "@/lib/format";
import { ReviewModal } from "./review-modal";

export type PublishedReview = {
  id: string;
  displayName: string;
  rating: number;
  displayText: string | null;
  originalText: string;
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
  const [productFilter, setProductFilter] = useState<string | "all">("all");
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
            <span className="text-3xl font-extrabold text-[#1E6B34]">{avgRating.toFixed(1)}</span>
            <span className="text-[#8C8375] font-semibold text-lg">/ 5.0</span>
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
                <span className="w-12 font-bold text-[#3B342A]">{star} ★</span>
                <div className="flex-1 h-3 bg-[#F2ECE1] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono font-semibold text-[#6E6658]">
                  {pct}% ({count})
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Filter & Sort Bar */}
      <section className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#FAF6F0] border border-[#E8E3D8]">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg transition ${
              starFilter === "all" ? "bg-[#2C261E] text-white" : "bg-white text-[#5C5446] border border-[#DCD6C9]"
            }`}
            onClick={() => setStarFilter("all")}
          >
            {copy.all} ({reviewsList.length})
          </button>

          {[5, 4, 3].map((star) => (
            <button
              key={star}
              type="button"
              className={`px-3 py-1.5 rounded-lg transition ${
                starFilter === star ? "bg-[#2C261E] text-white" : "bg-white text-[#5C5446] border border-[#DCD6C9]"
              }`}
              onClick={() => setStarFilter(star)}
            >
              {star} ★
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <label className="text-[#6E6658]">Järjestä / Sort:</label>
          <select
            className="bg-white border border-[#DCD6C9] rounded-lg px-3 py-1.5 text-xs text-[#2C261E]"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
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
            className="p-6 rounded-2xl bg-white border border-[#E7E2D7] shadow-xs space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F2ECE1] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-500 text-sm font-bold">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </span>
                <span className="font-extrabold text-[#2C261E] text-base">{review.displayName}</span>

                {review.verifiedBuyer ? (
                  <span className="bg-[#EAF5EC] text-[#1E6B34] text-xs font-semibold px-2.5 py-0.5 rounded-full border border-[#C5E5CC]">
                    {copy.verifiedOrder}
                  </span>
                ) : (
                  <span className="bg-[#F5F0E6] text-[#6E6658] text-xs font-medium px-2 py-0.5 rounded">
                    {copy.publicReview}
                  </span>
                )}
              </div>

              <span className="text-xs text-[#8C8375] font-medium">
                {new Date(review.createdAt).toLocaleDateString(locale === "fi" ? "fi-FI" : "en-US")}
              </span>
            </div>

            <p className="text-sm text-[#383228] leading-relaxed">
              "{review.displayText || review.originalText}"
            </p>

            {/* Seller Reply */}
            {review.sellerReplyText && (
              <div className="mt-3 p-4 rounded-xl bg-[#F4F9F5] border border-[#D1EADB] text-xs space-y-1">
                <p className="font-extrabold text-[#1E6B34]">{copy.sellerReplyTitle}</p>
                <p className="text-[#24452C] font-medium italic">"{review.sellerReplyText}"</p>
              </div>
            )}
          </article>
        ))}

        {sorted.length > visibleCount && (
          <div className="pt-4 text-center space-y-2">
            <p className="text-xs font-semibold text-[#8C8375]">
              {copy.showingCount(visibleCount, sorted.length)}
            </p>
            <button
              type="button"
              className="btn bg-[#1E6B34] hover:bg-[#144A23] text-white font-extrabold text-xs px-6 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
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
