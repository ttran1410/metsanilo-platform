export type Locale = "fi" | "en";

export function isLocale(value: string): value is Locale {
  return value === "fi" || value === "en";
}

export function intlLocale(locale: Locale) {
  return locale === "fi" ? "fi-FI" : "en-GB";
}

export function formatDecimal(value: number, locale: Locale, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function formatStorefrontDate(value: string | Date, locale: Locale, options?: Intl.DateTimeFormatOptions) {
  const date = typeof value === "string"
    ? new Date(value.includes("T") ? value : `${value}T12:00:00`)
    : value;
  return new Intl.DateTimeFormat(intlLocale(locale), options ?? { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatLitres(ml: number, locale: Locale) {
  return new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: 3,
  }).format(ml / 1000);
}

export function formatEuros(cents: number, locale: Locale) {
  return new Intl.NumberFormat(intlLocale(locale), {
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
