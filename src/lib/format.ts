export type Locale = "fi" | "en";

export function isLocale(value: string): value is Locale {
  return value === "fi" || value === "en";
}

export function formatLitres(ml: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-FI", {
    maximumFractionDigits: 3,
  }).format(ml / 1000);
}

export function formatEuros(cents: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-FI", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function todayInTimezone(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
