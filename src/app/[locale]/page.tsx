import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getPublicCatalog } from "@/domain/availability";
import { isLocale, type Locale } from "@/lib/format";
import { copy } from "@/lib/i18n";
import { env } from "@/lib/env";
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
      <section className="shell py-8">
        <h2 className="text-3xl font-bold text-[var(--forest)]">{t.shopHeading}</h2>
        <p className="mt-2">{t.pending}</p>
        <OrderForm
          locale={locale}
          products={[...productMap.values()]}
          idempotencyKey={randomUUID()}
          privacyNoticeUrl={env().PRIVACY_NOTICE_URL}
          pickup={{
            name: locale === "fi" ? data.shop.pickupNameFi : data.shop.pickupNameEn,
            address: data.shop.pickupAddress,
            instructions: locale === "fi" ? data.shop.pickupInstructionsFi : data.shop.pickupInstructionsEn,
            time: data.shop.pickupTime,
          }}
        />
      </section>
    </main>
  );
}
