import Link from "next/link";
import type { Locale } from "@/lib/format";

const labels = {
  fi: { menu: "Valikko", reserve: "Varaa tuotteet", how: "Miten toimii", reviews: "Arvostelut", about: "Meistä" },
  en: { menu: "Menu", reserve: "Reserve products", how: "How it works", reviews: "Reviews", about: "About us" },
} satisfies Record<Locale, Record<string, string>>;

export function MobileNav({ locale, active }: { locale: Locale; active?: "reserve" | "how" | "reviews" | "about" }) {
  const t = labels[locale];
  const links = [["reserve", t.reserve, `/${locale}/reserve`], ["how", t.how, `/${locale}/how-it-works`], ["reviews", t.reviews, `/${locale}/reviews`], ["about", t.about, `/${locale}/about`]] as const;
  return <details className="mobile-nav-menu"><summary><span className="mobile-nav-icon" aria-hidden="true"><i /><i /><i /></span><span>{t.menu}</span></summary><nav aria-label={t.menu}>{links.map(([key, label, href]) => <Link className={active === key ? "nav-link-active" : ""} href={href} key={key}>{label}</Link>)}</nav></details>;
}
