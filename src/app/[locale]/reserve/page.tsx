import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getPublicCatalog } from "@/domain/availability";
import { isLocale, type Locale } from "@/lib/format";
import { copy } from "@/lib/i18n";
import { OrderForm, type PublicProduct } from "../order-form";
import { LocaleDocument } from "../locale-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ReservePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ product?: string; package?: string; notice?: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale; const t = copy[locale]; const data = await getPublicCatalog(db());
  if (!data) return <main className="shell py-12"><div className="card">Shop is not configured.</div></main>;
  const productMap = new Map<string, PublicProduct>();
  for (const row of data.rows) {
    const product = productMap.get(row.product.id) ?? { id: row.product.id, name: locale === "fi" ? row.product.nameFi : row.product.nameEn, description: locale === "fi" ? row.product.descriptionFi : row.product.descriptionEn, media: [], packages: [], dates: [] };
    if (!productMap.has(row.product.id)) productMap.set(row.product.id, product);
    if (!product.packages.some((item) => item.id === row.package.id)) product.packages.push({ id: row.package.id, label: locale === "fi" ? row.package.labelFi : row.package.labelEn, volumeMl: row.package.volumeMl, priceCents: row.package.priceCents });
    if (!product.dates.some((item) => item.date === row.availability.businessDate)) product.dates.push({ date: row.availability.businessDate, remainingMl: row.availability.capacityMl - row.availability.reservedMl, acceptsOrders: row.availability.acceptsOrders, soldOut: row.availability.manualSoldOut || row.availability.capacityMl === row.availability.reservedMl });
  }
  for (const product of productMap.values()) product.media = data.media.filter((image) => image.productId === product.id).map((image) => ({ id: image.id, url: image.url, alt: locale === "fi" ? image.altFi : image.altEn, isPrimary: image.isPrimary }));
  const products = [...productMap.values()]; const query = await searchParams; const requestedProduct = query.product ? products.find((item) => item.id === query.product) : undefined; const productAvailable = (product: PublicProduct) => product.packages.some((pkg) => product.dates.some((date) => date.acceptsOrders && !date.soldOut && date.remainingMl >= pkg.volumeMl));
  const selectedProduct = requestedProduct && productAvailable(requestedProduct) ? requestedProduct : undefined; const requestedPackage = selectedProduct && query.package ? selectedProduct.packages.find((item) => item.id === query.package) : undefined; const packageAvailable = requestedPackage && selectedProduct?.dates.some((date) => date.acceptsOrders && !date.soldOut && date.remainingMl >= requestedPackage.volumeMl); const initialProductId = query.product === undefined ? undefined : selectedProduct?.id ?? ""; const initialPackageId = packageAvailable ? requestedPackage?.id : undefined; const notice = requestedProduct && !productAvailable(requestedProduct) ? "sold-out" : query.product && !requestedProduct ? "invalid-selection" : query.package && !query.product ? "invalid-selection" : requestedPackage && !packageAvailable ? "sold-out" : query.notice;
  const noticeText = notice === "sold-out" ? (locale === "fi" ? "Tämä tuote tai pakkaus on loppuunmyyty. Valitse toinen vaihtoehto." : "This product or package is sold out. Please choose another option.") : notice === "invalid-selection" ? (locale === "fi" ? "Valintaa ei löytynyt. Valitse tuote alla." : "We couldn't find that selection. Please choose a product below.") : "";
  return <main className="storefront"><LocaleDocument locale={locale} /><header className="storefront-header"><div className="shell storefront-nav"><a className="brand-lockup" href={`/${locale}`}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span><strong>METSÄNILO</strong></span></a><nav className="storefront-nav-links" aria-label={locale === "fi" ? "Päävalikko" : "Main navigation"}><a href={`/${locale}/how-it-works`}>{locale === "fi" ? "Miten toimii" : "How it works"}</a><a href={`/${locale}/reviews`}>{locale === "fi" ? "Arvostelut" : "Reviews"}</a><a href={`/${locale}/about`}>{locale === "fi" ? "Meistä" : "About us"}</a></nav><a className="locale-switch" href={`/${locale === "fi" ? "en" : "fi"}/reserve`}>{t.switchLocale}<span aria-hidden="true">↗</span></a></div></header><section className="order-section reserve-page-section" aria-labelledby="reserve-title"><div className="shell"><div className="order-intro"><div><p className="eyebrow">{locale === "fi" ? "Varaa verkossa" : "Reserve online"}</p><h1 id="reserve-title">{t.shopHeading}</h1><p className="order-intro-lede">{locale === "fi" ? "Valitse tuotteet, noutopäivä ja yhteystietosi." : "Choose your products, fulfillment date and contact details."}</p></div><div className="order-intro-note"><span>01—03</span><p>{t.pending}</p></div></div>{noticeText && <div className="reserve-selection-notice" role="status">{noticeText}</div>}<OrderForm locale={locale} products={products} initialProductId={initialProductId} initialPackageId={initialPackageId} idempotencyKey={randomUUID()} privacyNoticeUrl={locale === "fi" ? "/fi/tietosuoja" : "/en/privacy"} pickup={{ name: locale === "fi" ? data.shop.pickupNameFi : data.shop.pickupNameEn, address: data.shop.pickupAddress, instructions: locale === "fi" ? data.shop.pickupInstructionsFi : data.shop.pickupInstructionsEn, time: data.shop.pickupTime }} contact={{ phone: data.shop.contactPhone, email: data.shop.contactEmail, hours: data.shop.contactHours }} /></div></section></main>;
}
