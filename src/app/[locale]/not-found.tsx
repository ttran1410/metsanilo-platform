"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Compass } from "lucide-react";

export default function StorefrontNotFound() {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale === "en" ? "en" : "fi";
  const copy =
    locale === "fi"
      ? {
          eyebrow: "404 · SIVUA EI LÖYTYNYT",
          title: "Etsimääsi sivua ei löytynyt",
          text: "Sivu saattaa olla siirretty, poistettu tai tilapäisesti pois käytöstä.",
          home: "Palaa etusivulle",
        }
      : {
          eyebrow: "404 · PAGE NOT FOUND",
          title: "We couldn't find that page",
          text: "The page may have moved, been removed, or be temporarily unavailable.",
          home: "Return to homepage",
        };

  return (
    <main
      className="storefront min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center"
      data-theme="forest-harvest"
    >
      <div className="max-w-md w-full card p-8 border border-line shadow-lg bg-surface rounded-3xl flex flex-col items-center gap-5 animate-in fade-in zoom-in-95">
        {/* Brand Logo & Mark */}
        <div className="flex items-center gap-2">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong className="text-xl font-bold tracking-wider text-ink">METSÄNILO</strong>
        </div>

        <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-primary">
          <Compass className="w-8 h-8 stroke-[1.5]" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-primary block">
            {copy.eyebrow}
          </span>
          <h1 className="text-2xl font-bold text-ink">
            {copy.title}
          </h1>
          <p className="text-xs muted leading-relaxed">
            {copy.text}
          </p>
        </div>

        <div className="pt-3 w-full border-t border-line flex flex-col gap-2">
          <Link
            href={`/${locale}/reserve`}
            className="btn w-full text-xs font-bold py-3 px-6 rounded-xl shadow-sm text-center flex items-center justify-center gap-2"
          >
            <span>{locale === "fi" ? "Varaa marjoja" : "Reserve berries"}</span>
          </Link>
          <Link
            href={`/${locale}`}
            className="btn btn-secondary w-full text-xs font-bold py-3 px-6 rounded-xl text-center flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{copy.home}</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
