import Link from "next/link";
import { Menu } from "lucide-react";
import type { Locale } from "@/lib/format";

const labels = {
  fi: { menu: "Valikko", home: "Etusivu", reserve: "Varaa tuotteet", how: "Miten toimii", reviews: "Arvostelut", about: "Meistä" },
  en: { menu: "Menu", home: "Home", reserve: "Reserve products", how: "How it works", reviews: "Reviews", about: "About us" },
} satisfies Record<Locale, Record<string, string>>;

export function MobileNav({
  locale,
  active,
  reviewsVisible = true,
  howItWorksVisible = true,
  aboutUsVisible = true,
}: {
  locale: Locale;
  active?: "home" | "reserve" | "how" | "reviews" | "about";
  reviewsVisible?: boolean;
  howItWorksVisible?: boolean;
  aboutUsVisible?: boolean;
}) {
  const t = labels[locale];
  const links = [
    ["home", t.home, `/${locale}`, true],
    ["reserve", t.reserve, `/${locale}/reserve`, true],
    ["how", t.how, `/${locale}/how-it-works`, howItWorksVisible],
    ["reviews", t.reviews, `/${locale}/reviews`, reviewsVisible],
    ["about", t.about, `/${locale}/about`, aboutUsVisible],
  ] as const;

  return (
    <details className="mobile-nav-menu">
      <summary>
        <Menu className="mobile-nav-icon" aria-hidden="true" />
        <span>{t.menu}</span>
      </summary>
      <nav aria-label={t.menu}>
        {links
          .filter(([, , , visible]) => visible)
          .map(([key, label, href]) => (
            <Link className={active === key ? "nav-link-active" : ""} href={href} key={key}>
              {label}
            </Link>
          ))}
      </nav>
    </details>
  );
}
