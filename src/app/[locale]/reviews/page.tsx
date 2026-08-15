import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getPublicCatalog } from "@/domain/availability";
import { isLocale, type Locale } from "@/lib/format";
import { InfoPage } from "../info-page";

export default async function ReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const data = await getPublicCatalog(db());
  return <InfoPage locale={rawLocale as Locale} kind="reviews" contactPhone={data?.shop.contactPhone} contactEmail={data?.shop.contactEmail} />;
}
