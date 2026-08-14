import { randomUUID } from "node:crypto";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getPublicCatalog } from "@/domain/availability";
import { formatEuros, formatLitres, isLocale, type Locale } from "@/lib/format";
import { copy } from "@/lib/i18n";
import { OrderForm, type PublicProduct } from "./order-form";
import { ProductGallery } from "./product-gallery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    let product = productMap.get(row.product.id);
    if (!product) {
      product = {
        id: row.product.id,
        name: locale === "fi" ? row.product.nameFi : row.product.nameEn,
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
      });
    }
    if (!product.dates.some((item) => item.date === row.availability.businessDate)) {
      product.dates.push({
        date: row.availability.businessDate,
        remainingMl: row.availability.capacityMl - row.availability.reservedMl,
        acceptsOrders: row.availability.acceptsOrders,
        soldOut: row.availability.manualSoldOut || row.availability.capacityMl === row.availability.reservedMl,
      });
    }
  }

  const shopName = locale === "fi" ? data.shop.nameFi : data.shop.nameEn;
  const products = [...productMap.values()];
  const heroImage = products.flatMap((product) => product.media).find((image) => image.isPrimary) ?? products[0]?.media[0];
  const seasonYear = new Date().getFullYear();
  return (
    <main className="storefront">
      <header className="storefront-header">
        <div className="shell storefront-nav">
          <Link className="brand-lockup" href={`/${locale}`} aria-label={`${shopName} — ${locale === "fi" ? "etusivu" : "home"}`}>
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span><strong>METSÄNILO</strong><small>{shopName}</small></span>
          </Link>
          <p className="nav-season">{locale === "fi" ? `Satakunnan metsistä · Kausi ${seasonYear}` : `From Satakunta forests · Season ${seasonYear}`}</p>
          <Link className="locale-switch" href={`/${otherLocale}`} hrefLang={otherLocale}>
            {t.switchLocale}<span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <section className="shell storefront-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{locale === "fi" ? "Villi · Puhdas · Satakunnasta" : "Wild · Clean · From Satakunta"}</p>
          <h1 id="hero-title">{locale === "fi" ? <>Metsän maku,<br /><em>talteen kesästä.</em></> : <>The taste of the forest,<br /><em>saved from summer.</em></>}</h1>
          <p className="hero-lede">{locale === "fi" ? "Käsin poimittuja, huolellisesti puhdistettuja metsämustikoita. Varaa satosi verkossa ja nouda Porista." : "Hand-picked, carefully cleaned wild blueberries. Reserve your harvest online and collect it in Pori."}</p>
          <div className="hero-actions">
            <a className="btn btn-light" href="#catalog">{locale === "fi" ? "Tutustu satoon" : "Explore the harvest"}<span aria-hidden="true">↓</span></a>
            <a className="text-link" href="#order">{locale === "fi" ? "Siirry varaukseen" : "Go to reservation"}<span aria-hidden="true">→</span></a>
          </div>
          <dl className="hero-facts">
            <div><dt>{locale === "fi" ? "Alkuperä" : "Origin"}</dt><dd>Satakunta</dd></div>
            <div><dt>{locale === "fi" ? "Nouto" : "Pickup"}</dt><dd>Pori</dd></div>
            <div><dt>{locale === "fi" ? "Maksu" : "Payment"}</dt><dd>{locale === "fi" ? "Vahvistuksen jälkeen" : "After confirmation"}</dd></div>
          </dl>
        </div>
        <div className="hero-visual" aria-hidden={!heroImage}>
          {heroImage ? <Image src={heroImage.url} alt={heroImage.alt} fill priority unoptimized sizes="(max-width: 960px) 100vw, 48vw" /> : <div className="hero-placeholder"><span>M</span></div>}
          <div className="harvest-seal"><span>{locale === "fi" ? "Kauden" : "Seasonal"}</span><strong>{locale === "fi" ? "SATO" : "HARVEST"}</strong><span>{seasonYear}</span></div>
          <p className="hero-caption">{locale === "fi" ? "Puhdistettu ja valmis pakastettavaksi" : "Cleaned and ready for freezing"}</p>
        </div>
      </section>

      <section className="promise-strip" aria-label={locale === "fi" ? "Metsänilon lupaus" : "The Metsänilo promise"}>
        <div className="shell">
          {[locale === "fi" ? "Suoraan Satakunnan metsistä" : "Direct from Satakunta forests", locale === "fi" ? "Puhdistettu käsin" : "Carefully cleaned by hand", locale === "fi" ? "Ei ennakkomaksua" : "No prepayment"].map((item, index) => <p key={item}><span>0{index + 1}</span>{item}</p>)}
        </div>
      </section>

      <section id="catalog" className="shell storefront-section catalog-section" aria-labelledby="catalog-title">
        <div className="section-heading">
          <div><p className="eyebrow">{locale === "fi" ? "Tämän hetken sato" : "This season's harvest"}</p><h2 id="catalog-title">{locale === "fi" ? "Valitse omasi" : "Choose yours"}</h2></div>
          <p>{locale === "fi" ? "Saatavuus päivittyy varauksien mukaan. Valitse sopiva pakkaus ja tarkista vapaa noutopäivä." : "Availability updates as reservations arrive. Choose a package and check the available pickup dates."}</p>
        </div>
        <div className="catalog-grid">{products.map((product, productIndex) => {
          const available = product.packages.some((pkg) => product.dates.some((date) => date.acceptsOrders && !date.soldOut && date.remainingMl >= pkg.volumeMl));
          return <article className="catalog-card" key={product.id}>
          <div className="catalog-media"><ProductGallery images={product.media} previousLabel={locale === "fi" ? "Edellinen kuva" : "Previous image"} nextLabel={locale === "fi" ? "Seuraava kuva" : "Next image"} slideLabel={locale === "fi" ? "Tuotekuva" : "Product image"} /><span className="catalog-index">0{productIndex + 1}</span></div>
          <div className="catalog-content">
            <div className="catalog-title-row"><div><p className="product-kicker">{locale === "fi" ? "Metsämarja" : "Wild berry"}</p><h3>{product.name}</h3></div><span className={`availability-dot${available ? "" : " unavailable"}`}>{available ? (locale === "fi" ? "Saatavilla" : "Available") : t.soldOut}</span></div>
            <div className="package-list">{product.packages.map((pkg) => { const litres = pkg.volumeMl / 1000; const unitPriceCents = litres > 0 ? Math.round(pkg.priceCents / litres) : pkg.priceCents; return <div className="package-row" key={pkg.id}><span><strong>{pkg.label}</strong><small>{formatLitres(pkg.volumeMl, locale)} l · {formatEuros(unitPriceCents, locale)}/{locale === "fi" ? "l" : "L"} · {locale === "fi" ? "puhdistettu" : "cleaned"}</small></span><strong>{formatEuros(pkg.priceCents, locale)}</strong></div>; })}</div>
            <a className="btn btn-accent" href="#order">{locale === "fi" ? "Varaa tämä tuote" : "Reserve this product"}<span aria-hidden="true">→</span></a>
          </div>
        </article>})}</div>
      </section>

      <section id="order" className="order-section" aria-labelledby="order-title">
        <div className="shell">
          <div className="order-intro">
            <div><p className="eyebrow">{locale === "fi" ? "Helppo varaus" : "Simple reservation"}</p><h2 id="order-title">{t.shopHeading}</h2></div>
            <div className="order-intro-note"><span>01—03</span><p>{t.pending}</p></div>
          </div>
        <OrderForm
          locale={locale}
          products={products}
          idempotencyKey={randomUUID()}
          privacyNoticeUrl={locale === "fi" ? "/fi/tietosuoja" : "/en/privacy"}
          pickup={{
            name: locale === "fi" ? data.shop.pickupNameFi : data.shop.pickupNameEn,
            address: data.shop.pickupAddress,
            instructions: locale === "fi" ? data.shop.pickupInstructionsFi : data.shop.pickupInstructionsEn,
            time: data.shop.pickupTime,
          }}
          contact={{ phone: data.shop.contactPhone, email: data.shop.contactEmail, hours: data.shop.contactHours }}
        />
        </div>
      </section>

      <footer className="storefront-footer">
        <div className="shell footer-grid">
          <div><strong>METSÄNILO</strong><p>{locale === "fi" ? "Metsästä pöytään, Satakunnassa." : "From forest to table, in Satakunta."}</p></div>
          <div><span>{locale === "fi" ? "Yhteys" : "Contact"}</span>{data.shop.contactPhone && <a href={`tel:${data.shop.contactPhone}`}>{data.shop.contactPhone}</a>}{data.shop.contactEmail && <a href={`mailto:${data.shop.contactEmail}`}>{data.shop.contactEmail}</a>}</div>
          <div><span>{locale === "fi" ? "Tietoa" : "Information"}</span><Link href={locale === "fi" ? "/fi/tietosuoja" : "/en/privacy"}>{locale === "fi" ? "Tietosuojaseloste" : "Privacy notice"}</Link></div>
        </div>
      </footer>
    </main>
  );
}
