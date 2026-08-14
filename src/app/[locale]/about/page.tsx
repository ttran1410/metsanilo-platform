import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/format";
import { InfoPage } from "../info-page";

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  return <InfoPage locale={rawLocale as Locale} kind="about" />;
}
