import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { getPublicCatalog } from "@/domain/availability";
import { getReviewRollup, getReviewsVisibility, listPublishedReviews } from "@/domain/reviews";
import { isLocale, type Locale } from "@/lib/format";
import { LocaleDocument } from "../locale-document";
import { MobileNav } from "../mobile-nav";
import { ReviewsHub } from "./reviews-hub";

export const dynamic = "force-dynamic";

const navCopy = {
  fi: { home: "Etusivu", how: "Miten varaus toimii", reviews: "Arvostelut", about: "Meistä", reserve: "Varaa marjat", contact: "Yhteys" },
  en: { home: "Home", how: "How it works", reviews: "Reviews", about: "About us", reserve: "Reserve products", contact: "Contact" },
};

export default async function ReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;

  if (!(await getReviewsVisibility(db()))) notFound();

  const data = await getPublicCatalog(db());
  const published = await listPublishedReviews(db(), { locale });
  const publishedRows = Array.isArray(published) ? published : published.items;
  const rollup = await getReviewRollup(db());
  const nav = navCopy[locale];
  const other = locale === "fi" ? "en" : "fi";

  return (
    <main className="storefront min-h-screen bg-[#FAF8F5]" data-theme="forest-harvest">
      <LocaleDocument locale={locale} />
      
      {/* Navigation Header */}
      <header className="storefront-header">
        <div className="shell storefront-nav">
          <Link className="brand-lockup" href={`/${locale}`}>
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>
              <strong>METSÄNILO</strong>
            </span>
          </Link>
          <nav className="storefront-nav-links" aria-label={locale === "fi" ? "Päävalikko" : "Main navigation"}>
            <Link href={`/${locale}`}>{nav.home}</Link>
            <Link href={`/${locale}/reserve`}>{nav.reserve}</Link>
            <Link href={`/${locale}/how-it-works`}>{nav.how}</Link>
            <Link href={`/${locale}/reviews`} className="nav-link-active">
              {nav.reviews}
            </Link>
            <Link href={`/${locale}/about`}>{nav.about}</Link>
          </nav>
          <MobileNav locale={locale} active="reviews" />
          <Link className="locale-switch" href={`/${other}/reviews`} hrefLang={other}>
            {locale === "fi" ? "English" : "Suomeksi"}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      {/* Main Social Proof Hub */}
      <div className="shell py-8">
          <ReviewsHub locale={locale} initialReviews={publishedRows} rollup={rollup} />
      </div>

      {/* Footer */}
      <footer className="storefront-footer mt-16">
        <div className="shell footer-grid">
          <div>
            <strong>METSÄNILO</strong>
            <p>
              {locale === "fi"
                ? `Satakunnan metsästä pöytään · Kausi ${new Date().getFullYear()}`
                : `From Satakunta forest to table · Season ${new Date().getFullYear()}`}
            </p>
          </div>
          <div>
            <span>{locale === "fi" ? "Tutustu" : "Explore"}</span>
            <Link href={`/${locale}/reserve`}>{nav.reserve}</Link>
            <Link href={`/${locale}/how-it-works`}>{nav.how}</Link>
            <Link href={`/${locale}/reviews`}>{nav.reviews}</Link>
            <Link href={`/${locale}/about`}>{nav.about}</Link>
          </div>
          <div>
            <span>{nav.contact}</span>
            {data?.shop.contactPhone && <a href={`tel:${data.shop.contactPhone}`}>{data.shop.contactPhone}</a>}
            {data?.shop.contactEmail && <a href={`mailto:${data.shop.contactEmail}`}>{data.shop.contactEmail}</a>}
          </div>
        </div>
      </footer>
    </main>
  );
}
