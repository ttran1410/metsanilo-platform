import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getPublicCatalog } from "@/domain/availability";
import { formatEuros, formatLitres, isLocale, type Locale } from "@/lib/format";
import { copy } from "@/lib/i18n";
import type { PublicProduct } from "./order-form";
import { ProductGallery } from "./product-gallery";
import { LocaleDocument } from "./locale-document";
import { MobileNav } from "./mobile-nav";
import { listPublishedReviews } from "@/domain/reviews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AvailabilityStatus = "available" | "today" | "unavailable" | "season";
const availabilityLabels: Record<Locale, Record<AvailabilityStatus, string>> = {
  fi: { available: "Saatavilla", today: "Tämän päivän erä on varattu", unavailable: "Tilapäisesti loppu", season: "Saatavuus päättynyt tältä kaudelta" },
  en: { available: "Available", today: "Fully reserved for today", unavailable: "Currently unavailable", season: "Seasonal availability ended" },
};

function getAvailabilityStatus(dates: PublicProduct["dates"], volumeMl?: number): AvailabilityStatus {
  const today = new Date().toISOString().slice(0, 10);
  const canOrder = dates.some((date) => date.acceptsOrders && !date.soldOut && (volumeMl === undefined || date.remainingMl >= volumeMl));
  if (canOrder) return "available";
  const todayDate = dates.find((date) => date.date === today);
  if (todayDate?.soldOut || (todayDate && volumeMl !== undefined && todayDate.remainingMl < volumeMl)) return "today";
  if (!dates.some((date) => date.date > today && date.acceptsOrders)) return "season";
  return "unavailable";
}

export default async function ShopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const t = copy[locale];
  const data = await getPublicCatalog(db());
  const otherLocale = locale === "fi" ? "en" : "fi";

  if (!data) {
    return <main className="shell py-12"><div className="card">Shop is not configured.</div></main>;
  }

  const productMap = new Map<string, PublicProduct>();
  for (const row of data.rows) {
    if (!row.product.showOnHomepage) continue;
    let product = productMap.get(row.product.id);
    if (!product) {
      product = {
        id: row.product.id,
        name: locale === "fi" ? row.product.nameFi : row.product.nameEn,
        description: locale === "fi" ? row.product.descriptionFi : row.product.descriptionEn,
        media: data.media.filter((image) => image.productId === row.product.id).map((image) => ({ id: image.id, url: image.url, alt: locale === "fi" ? image.altFi : image.altEn, isPrimary: image.isPrimary })),
        packages: [],
        dates: [],
      };
      productMap.set(row.product.id, product);
    }
    if (!product.packages.some((item) => item.id === row.package.id)) {
      product.packages.push({
        id: row.package.id,
        label: locale === "fi" ? row.package.labelFi : row.package.labelEn,
        volumeMl: row.package.volumeMl,
        priceCents: row.package.priceCents,
        isDefault: row.package.isDefault,
        sortOrder: row.package.sortOrder,
      });
    }
    const availabilityRow = row.availability;
    if (availabilityRow && !product.dates.some((item) => item.date === availabilityRow.businessDate)) {
      product.dates.push({
        date: availabilityRow.businessDate,
        remainingMl: availabilityRow.capacityMl - availabilityRow.reservedMl,
        acceptsOrders: availabilityRow.acceptsOrders,
        soldOut: availabilityRow.manualSoldOut || availabilityRow.capacityMl === availabilityRow.reservedMl,
      });
    }
  }

  const shopName = locale === "fi" ? data.shop.nameFi : data.shop.nameEn;
  const products = [...productMap.values()];
  const publishedReviews = data.shop.reviewsVisible ? (await listPublishedReviews(db())).filter((review) => review.featured).slice(0, 3) : [];
  const nextPickupDates = products.flatMap((product) => product.dates.filter((date) => date.acceptsOrders && !date.soldOut).map((date) => date.date)).filter((date, index, dates) => dates.indexOf(date) === index).sort();
  const toLocalIso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const today = new Date();
  const todayIso = toLocalIso(today);
  today.setDate(today.getDate() + 1);
  const tomorrowIso = toLocalIso(today);
  const nextPickupDate = nextPickupDates.find((date) => date >= tomorrowIso) ?? nextPickupDates.find((date) => date === todayIso) ?? nextPickupDates[0];
  const nextPickupLabel = nextPickupDate ? `${nextPickupDate === tomorrowIso ? (locale === "fi" ? "Huomenna" : "Tomorrow") : new Intl.DateTimeFormat(locale === "fi" ? "fi-FI" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${nextPickupDate}T12:00:00`))}` : (locale === "fi" ? "Ei noutopäivää saatavilla" : "No pickup date available");
  const nextPickupRemainingMl = nextPickupDate ? products.reduce((total, product) => total + (product.dates.find((date) => date.date === nextPickupDate && date.acceptsOrders && !date.soldOut)?.remainingMl ?? 0), 0) : 0;
  const nextPickupCapacityLabel = nextPickupDate ? `${formatLitres(nextPickupRemainingMl, locale)} l ${locale === "fi" ? "jäljellä" : "remaining"}` : "";
  const heroImage = products.flatMap((product) => product.media).find((image) => image.isPrimary) ?? products[0]?.media[0];
  const seasonYear = new Date().getFullYear();
  return (
    <main className="storefront">
      <LocaleDocument locale={locale} />
      <header className="storefront-header">
        <div className="shell storefront-nav">
          <Link className="brand-lockup" href={`/${locale}`} aria-label={`${shopName} — ${locale === "fi" ? "etusivu" : "home"}`}>
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span><strong>METSÄNILO</strong></span>
          </Link>
          <nav className="storefront-nav-links" aria-label={locale === "fi" ? "Päävalikko" : "Main navigation"}>
            <Link href={`/${locale}/reserve`}>{locale === "fi" ? "Varaa marjat" : "Reserve products"}</Link>
            <Link href={`/${locale}/how-it-works`}>{locale === "fi" ? "Miten toimii" : "How it works"}</Link>
            {data.shop.reviewsVisible && <Link href={`/${locale}/reviews`}>{locale === "fi" ? "Arvostelut" : "Reviews"}</Link>}
            <Link href={`/${locale}/about`}>{locale === "fi" ? "Meistä" : "About us"}</Link>
          </nav>
          <MobileNav locale={locale} />
          <Link className="locale-switch" href={`/${otherLocale}`} hrefLang={otherLocale}>
            {t.switchLocale}<span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <section className="shell storefront-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{locale === "fi" ? "Satakunnan metsistä" : "From Satakunta forests"}</p>
          <h1 id="hero-title">{locale === "fi" ? "Tuoreet marjat suoraan metsästä" : "Fresh berries from the forest"}</h1>
          <p className="hero-lede">{locale === "fi" ? "Huolellisesti puhdistettuja metsämustikoita. Tee varaus ennakkoon – ei ennakkomaksua." : "Carefully cleaned wild blueberries. Reserve ahead – no prepayment."}</p>
          <div className="hero-highlights" aria-label={locale === "fi" ? "Tärkeät tiedot" : "Key information"}>
            <span className="highlight-chip"><span aria-hidden="true">▣</span>{locale === "fi" ? "Seuraava nouto" : "Next pickup"}: <strong>{nextPickupLabel}</strong></span>
            {nextPickupCapacityLabel && <span className="highlight-chip"><span aria-hidden="true">🫐</span><strong>{formatLitres(nextPickupRemainingMl, locale)} l</strong> {locale === "fi" ? "jäljellä yhteensä" : "total remaining"}</span>}
            <span className="highlight-chip"><span aria-hidden="true">✓</span>{locale === "fi" ? "Maksu noudettaessa tai toimitettaessa" : "Pay at pickup or delivery"}</span>
          </div>
          <div className="hero-actions">
            <Link className="btn btn-light hero-primary-cta" href={`/${locale}/reserve`}>{locale === "fi" ? "Varaa marjoja" : "Reserve products"}<span aria-hidden="true">→</span></Link>
            <a className="btn btn-hero-secondary" href="#catalog">{locale === "fi" ? "Katso valikoima" : "Explore harvest"}<span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div className="hero-visual" aria-hidden={!heroImage}>
          {heroImage ? <Image src={heroImage.url} alt={heroImage.alt || (locale === "fi" ? "Tuoreita puhdistettuja metsämarjoja Satakunnasta" : "Fresh cleaned wild berries from Satakunta")} fill priority unoptimized sizes="(max-width: 960px) 100vw, 48vw" /> : <div className="hero-placeholder"><span>M</span></div>}
          <div className="harvest-seal"><span>{locale === "fi" ? "Kauden" : "Seasonal"}</span><strong>{locale === "fi" ? "SATO" : "HARVEST"}</strong><span>{seasonYear}</span></div>
          <p className="hero-caption">{locale === "fi" ? "Puhdistettu ja valmis pakastettavaksi" : "Cleaned and ready for freezing"}</p>
        </div>
      </section>

      <section className="promise-strip" aria-label={locale === "fi" ? "Metsänilon lupaus" : "The Metsänilo promise"}>
        <div className="shell">
          {[locale === "fi" ? "Suoraan Satakunnan metsistä" : "Direct from Satakunta forests", locale === "fi" ? "Poimittu ja toimitettu samana päivänä" : "Picked and delivered the same day", locale === "fi" ? "Ei ennakkomaksua" : "No prepayment"].map((item, index) => <p key={item}><span>0{index + 1}</span>{item}</p>)}
        </div>
      </section>

      <section id="catalog" className="shell storefront-section catalog-section" aria-labelledby="catalog-title">
        <div className="section-heading">
          <div><p className="eyebrow">{locale === "fi" ? "Tämän hetken sato" : "This season's harvest"}</p><h2 id="catalog-title">{locale === "fi" ? "Valitse omasi" : "Choose yours"}</h2></div>
          <p>{locale === "fi" ? "Saatavuus päivittyy varauksien mukaan. Valitse sopiva pakkaus ja tarkista vapaa noutopäivä." : "Availability updates as reservations arrive. Choose a package and check the available pickup dates."}</p>
        </div>
        <div className="catalog-grid">{products.map((product) => {
          const available = product.packages.some((pkg) => product.dates.some((date) => date.acceptsOrders && !date.soldOut && date.remainingMl >= pkg.volumeMl));
          const productStatus = available ? "available" : getAvailabilityStatus(product.dates);
          const availablePackages = product.packages.filter((pkg) => product.dates.some((date) => date.acceptsOrders && !date.soldOut && date.remainingMl >= pkg.volumeMl));
          const bestValueId = availablePackages.reduce((best, pkg) => !best || pkg.priceCents / pkg.volumeMl < best.priceCents / best.volumeMl ? pkg : best, availablePackages[0])?.id;
          const shortDescription = product.description?.trim().split(/[.!?]/)[0] ?? "";
          return <article className="catalog-card" key={product.id}>
          <div className="catalog-media"><ProductGallery images={product.media} previousLabel={locale === "fi" ? "Edellinen kuva" : "Previous image"} nextLabel={locale === "fi" ? "Seuraava kuva" : "Next image"} slideLabel={locale === "fi" ? "Tuotekuva" : "Product image"} /><span className={`availability-badge catalog-availability-badge${available ? "" : " unavailable"}`}>{availabilityLabels[locale][productStatus]}</span></div>
          <div className="catalog-content">
            <div className="catalog-title-row"><div><p className="product-kicker">{locale === "fi" ? "Metsämarja" : "Wild berry"}</p><h3>{product.name}</h3></div></div>
            {shortDescription && <p className="catalog-description">{shortDescription}{shortDescription.length < (product.description?.length ?? 0) ? "…" : ""}</p>}
            <div className="package-list">{product.packages.slice(0, 3).map((pkg) => { const litres = pkg.volumeMl / 1000; const unitPriceCents = litres > 0 ? Math.round(pkg.priceCents / litres) : pkg.priceCents; const packageStatus = getAvailabilityStatus(product.dates, pkg.volumeMl); const packageAvailable = packageStatus === "available"; const packageContent = <><span className="package-info"><strong>{pkg.label}</strong><small>{formatLitres(pkg.volumeMl, locale)} l · {formatEuros(unitPriceCents, locale)}/{locale === "fi" ? "l" : "L"}</small></span><span className="package-price-block"><strong className="package-price">{formatEuros(pkg.priceCents, locale)}</strong>{packageAvailable ? <span className="package-action">{locale === "fi" ? "Valitse" : "Select"}<span aria-hidden="true">↗</span></span> : <span className="package-status">{availabilityLabels[locale][packageStatus]}</span>}</span>{bestValueId === pkg.id && packageAvailable && <span className="package-best-value">{locale === "fi" ? "Paras hinta / l" : "Best value"}</span>}</>; return packageAvailable ? <a className="package-card" href={`/${locale}/reserve?product=${encodeURIComponent(product.id)}&package=${encodeURIComponent(pkg.id)}`} key={pkg.id}>{packageContent}</a> : <div className="package-card package-card-unavailable" key={pkg.id}>{packageContent}</div>; })}{product.packages.length > 3 && <Link className="package-more-note" href={`/${locale}/reserve?product=${encodeURIComponent(product.id)}`}>{locale === "fi" ? `+ ${product.packages.length - 3} pakkausta varauslomakkeella` : `+ ${product.packages.length - 3} more packages on the reservation page`}<span aria-hidden="true">→</span></Link>}</div>
            <p className="food-safe-note">{locale === "fi" ? "Pakattu puhtaisiin elintarvikekäyttöön hyväksyttyihin pakkauksiin." : "Packed in clean, food-safe containers."}</p>
          </div>
        </article>})}{Array.from({ length: Math.max(0, 3 - products.length) }).map((_, index) => <article className="catalog-card coming-soon-card" key={`coming-soon-${index}`}><div className="catalog-media"><div className="hero-placeholder"><span>+</span></div></div><div className="catalog-content"><p className="eyebrow">{locale === "fi" ? "Tulossa pian" : "Coming soon"}</p><h3>{locale === "fi" ? "Uusi sato" : "New harvest"}</h3><p className="catalog-description">{locale === "fi" ? "Valikoimamme täydentyy kauden aikana." : "Our seasonal selection will grow during the harvest."}</p></div></article>)}</div>
      </section>

      {data.shop.reviewsVisible && publishedReviews.length > 0 && <section className="shell storefront-section homepage-reviews" aria-labelledby="homepage-reviews-title"><div className="section-heading"><div><p className="eyebrow">{locale === "fi" ? "Asiakaskokemuksia" : "Customer reviews"}</p><h2 id="homepage-reviews-title">{locale === "fi" ? "Mitä asiakkaamme sanovat" : "What customers say"}</h2></div><Link className="text-link" href={`/${locale}/reviews`}>{locale === "fi" ? "Katso kaikki" : "Read all reviews"} →</Link></div><div className="review-grid">{publishedReviews.map((review) => <article className="review-card" key={review.id}><div className="review-card-head"><h3>{review.displayName}</h3><span className="review-stars" aria-label={`${review.rating} stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div><p className="review-quote">“{review.displayText || review.originalText}”</p></article>)}</div></section>}
      <footer className="storefront-footer">
        <div className="shell footer-grid">
          <div><strong>METSÄNILO</strong><p>{locale === "fi" ? `Satakunnan metsästä pöytään · Kausi ${seasonYear}` : `From Satakunta forest to table · Season ${seasonYear}`}</p></div>
          <div><span>{locale === "fi" ? "Tutustu" : "Explore"}</span><Link href={`/${locale}/reserve`}>{locale === "fi" ? "Varaa marjat" : "Reserve products"}</Link><Link href={`/${locale}/how-it-works`}>{locale === "fi" ? "Miten varaus toimii" : "How it works"}</Link>{data.shop.reviewsVisible && <Link href={`/${locale}/reviews`}>{locale === "fi" ? "Arvostelut" : "Reviews"}</Link>}<Link href={`/${locale}/about`}>{locale === "fi" ? "Meistä" : "About us"}</Link></div>
          <div><span>{locale === "fi" ? "Yhteys" : "Contact"}</span>{data.shop.contactPhone && <a href={`tel:${data.shop.contactPhone}`}>{data.shop.contactPhone}</a>}{data.shop.contactEmail && <a href={`mailto:${data.shop.contactEmail}`}>{data.shop.contactEmail}</a>}</div>
          <div><span>{locale === "fi" ? "Tietoa" : "Information"}</span><Link href={locale === "fi" ? "/fi/tietosuoja" : "/en/privacy"}>{locale === "fi" ? "Tietosuojaseloste" : "Privacy notice"}</Link></div>
        </div>
      </footer>
      <a className="mobile-reserve-cta" href={`/${locale}/reserve`}>{locale === "fi" ? "Varaa marjoja" : "Reserve berries"}<span aria-hidden="true">→</span></a>
    </main>
  );
}
