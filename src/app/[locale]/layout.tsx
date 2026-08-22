import type { Metadata } from "next";
import type { ReactNode } from "react";

const metadataCopy = {
  fi: {
    title: "METSÄNILO — Metsän maku, talteen kesästä",
    description: "Käsin poimittuja ja huolellisesti puhdistettuja metsämarjoja Satakunnasta.",
  },
  en: {
    title: "METSÄNILO — Fresh wild berries from Satakunta",
    description: "Hand-picked and carefully cleaned wild berries from Satakunta, Finland.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "en" ? "en" : "fi";
  const copy = metadataCopy[locale];
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      languages: {
        fi: "/fi",
        en: "/en",
      },
    },
    openGraph: {
      title: copy.title,
      description: copy.description,
      locale: locale === "fi" ? "fi_FI" : "en_GB",
    },
    twitter: {
      title: copy.title,
      description: copy.description,
    },
  };
}

export default function StorefrontLocaleLayout({ children }: { children: ReactNode }) {
  return children;
}
