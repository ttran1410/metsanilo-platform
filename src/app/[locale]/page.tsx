import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getPublicCatalog } from "@/domain/availability";
import { formatEuros, formatLitres, isLocale, type Locale } from "@/lib/format";
import { copy } from "@/lib/i18n";
import { OrderForm, type PublicProduct } from "./order-form";

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
  return (
    <main>
      <header className="bg-[var(--forest)] text-white">
        <div className="shell flex items-center justify-between gap-4 py-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-[.2em]">METSÄNILO</div>
            <h1 className="mt-1 text-2xl font-bold">{shopName}</h1>
          </div>
          <Link className="rounded-md border border-white px-3 py-2 font-bold" href={`/${otherLocale}`} hrefLang={otherLocale}>
            {t.switchLocale}
          </Link>
        </div>
      </header>
      <section className="hero shell mt-6" aria-labelledby="hero-title">
        <p className="eyebrow">{locale === "fi" ? "Satakunnan kauden marjat" : "Seasonal berries from Satakunta"}</p>
        <h2 id="hero-title">{locale === "fi" ? "Tuoreita ja puhdistettuja metsämustikoita" : "Fresh, cleaned wild berries"}</h2>
        <p>{locale === "fi" ? "Varaa marjat helposti ennakkoon. Nouto Porista – toimituksesta sovitaan erikseen." : "Reserve your berries easily. Pickup in Pori – delivery is agreed separately."}</p>
        <div className="hero-actions"><a className="btn" href="#order">{locale === "fi" ? "Varaa marjoja" : "Reserve berries"}</a><a className="btn btn-secondary" href="#catalog">{locale === "fi" ? "Katso saatavuus" : "See availability"}</a></div>
        <div className="trust-grid" aria-label={locale === "fi" ? "Miksi METSÄNILO" : "Why METSÄNILO"}>
          {[locale === "fi" ? "Satakunnan metsistä" : "From Satakunta forests", locale === "fi" ? "Puhdistettu ja valmis pakastettavaksi" : "Cleaned and ready for freezing", locale === "fi" ? "Ei ennakkomaksua" : "No prepayment", locale === "fi" ? "Nouto Porista" : "Pickup in Pori"].map((item) => <div className="trust-item" key={item}>{item}</div>)}
        </div>
      </section>
      <section id="catalog" className="shell section" aria-labelledby="catalog-title">
        <div className="section-heading"><div><p className="eyebrow">{locale === "fi" ? "Saatavuus" : "Availability"}</p><h2 id="catalog-title">{locale === "fi" ? "Valitse marjat ja pakkaus" : "Choose berries and a package"}</h2></div></div>
        <div className="catalog-grid">{[...productMap.values()].map((product) => <article className="catalog-card" key={product.id}><h3>{product.name}</h3><div className="package-list">{product.packages.map((pkg) => <div className="package-row" key={pkg.id}><span>{pkg.label}<small>{formatLitres(pkg.volumeMl, locale)} l</small></span><strong>{formatEuros(pkg.priceCents, locale)}</strong></div>)}</div><a className="btn" href="#order">{locale === "fi" ? "Valitse ja tilaa" : "Choose and order"}</a></article>)}</div>
      </section>
      <section id="order" className="shell section" aria-labelledby="order-title">
        <h2 id="order-title" className="text-3xl font-bold text-[var(--forest)]">{t.shopHeading}</h2>
        <p className="mt-2">{t.pending}</p>
        <OrderForm
          locale={locale}
          products={[...productMap.values()]}
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
      </section>
    </main>
  );
}
