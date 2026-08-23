import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getPublicCatalog } from "@/domain/availability";
import { isLocale, type Locale } from "@/lib/format";
import { InfoPage } from "../info-page";
import { resolveStorefrontTheme } from "@/domain/storefront-themes";

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const data = await getPublicCatalog(db());
  if (data?.shop.aboutUsVisible === false) notFound();
  return (
    <InfoPage
      locale={rawLocale as Locale}
      kind="about"
      contactPhone={data?.shop.contactPhone}
      contactEmail={data?.shop.contactEmail}
      reviewsVisible={data?.shop.reviewsVisible ?? true}
      howItWorksVisible={data?.shop.howItWorksVisible ?? true}
      aboutUsVisible={data?.shop.aboutUsVisible ?? true}
      logoUrl={data?.shop.logoUrl}
      theme={resolveStorefrontTheme(data?.shop.storefrontTheme)}
    />
  );
}
