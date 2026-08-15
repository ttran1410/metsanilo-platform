import type { Locale } from "@/lib/format";

export const customerValidationCopy = {
  fi: {
    checkHighlighted: "Tarkista korostetut kentät.",
    required: "Täytä tämä pakollinen kenttä.",
    requiredNote: "Pakolliset kentät on merkitty *.",
    tooShort: "Anna vähintään 2 merkkiä.",
    reviewTooShort: "Kirjoita vähintään 10 merkkiä.",
    selectRating: "Valitse tähtiluokitus.",
    invalidPhone: "Anna kelvollinen puhelinnumero.",
    invalidEmail: "Anna kelvollinen sähköpostiosoite.",
    invalidPostalCode: "Anna viisinumeroinen postinumero.",
  },
  en: {
    checkHighlighted: "Please check the highlighted fields.",
    required: "This field is required.",
    requiredNote: "Required fields are marked *.",
    tooShort: "Enter at least 2 characters.",
    reviewTooShort: "Enter at least 10 characters.",
    selectRating: "Choose a star rating.",
    invalidPhone: "Enter a valid phone number.",
    invalidEmail: "Enter a valid email address.",
    invalidPostalCode: "Enter a five-digit postal code.",
  },
} satisfies Record<Locale, Record<string, string>>;

export function CustomerFieldError({ field, error }: { field: string; error?: string }) {
  return error ? <small className="field-error-message" id={`${field}-error`} role="alert">{error}</small> : null;
}

export function focusFirstCustomerFieldError<Field extends string>(form: HTMLFormElement, errors: Partial<Record<Field, string>>) {
  const firstField = Object.keys(errors).find((field) => errors[field as Field]);
  if (!firstField) return;
  requestAnimationFrame(() => {
    const container = form.querySelector<HTMLElement>(`[data-field="${firstField}"]`);
    const control = container?.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)");
    container?.scrollIntoView({ behavior: "smooth", block: "center" });
    control?.focus({ preventScroll: true });
  });
}
