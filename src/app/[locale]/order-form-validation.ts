import type { Locale } from "@/lib/format";
import { customerValidationCopy } from "./customer-form-validation";

export type ReservationField =
  | "productId"
  | "packageId"
  | "fulfillmentDate"
  | "customerName"
  | "mobile"
  | "email"
  | "streetAddress"
  | "postalCode"
  | "city";

export type ReservationValidationValues = {
  productId: string;
  packageId: string;
  fulfillmentDate: string;
  fulfillmentMethod: "PICKUP" | "DELIVERY";
  customerName: string;
  mobile: string;
  email: string;
  streetAddress: string;
  postalCode: string;
  city: string;
};

const messages = {
  fi: {
    selectProduct: "Valitse tuote.",
    selectPackage: "Valitse pakkaus.",
    selectDate: "Valitse nouto- tai toimituspäivä.",
  },
  en: {
    selectProduct: "Choose a product.",
    selectPackage: "Choose a package.",
    selectDate: "Choose a pickup or delivery date.",
  },
} satisfies Record<Locale, Record<string, string>>;

function validMobile(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  const normalized = compact.startsWith("0") ? `+358${compact.slice(1)}` : compact;
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateReservationFields(values: ReservationValidationValues, locale: Locale) {
  const t = { ...customerValidationCopy[locale], ...messages[locale] };
  const errors: Partial<Record<ReservationField, string>> = {};
  const customerName = values.customerName.trim();
  const mobile = values.mobile.trim();
  const email = values.email.trim();
  const streetAddress = values.streetAddress.trim();
  const postalCode = values.postalCode.trim();
  const city = values.city.trim();

  if (!values.productId) errors.productId = t.selectProduct;
  if (!values.packageId) errors.packageId = t.selectPackage;
  if (!values.fulfillmentDate) errors.fulfillmentDate = t.selectDate;
  if (!customerName) errors.customerName = t.required;
  else if (customerName.length < 2) errors.customerName = t.tooShort;
  if (!mobile) errors.mobile = t.required;
  else if (!validMobile(mobile)) errors.mobile = t.invalidPhone;
  if (email && !validEmail(email)) errors.email = t.invalidEmail;

  if (values.fulfillmentMethod === "DELIVERY") {
    if (!streetAddress) errors.streetAddress = t.required;
    else if (streetAddress.length < 2) errors.streetAddress = t.tooShort;
    if (postalCode && !/^\d{5}$/.test(postalCode)) errors.postalCode = t.invalidPostalCode;
    if (city && city.length < 2) errors.city = t.tooShort;
  }

  return errors;
}

export function localizeServerFieldErrors(errors: Record<string, string> | undefined, locale: Locale) {
  const t = { ...customerValidationCopy[locale], ...messages[locale] };
  const localized: Partial<Record<ReservationField, string>> = {};

  for (const [field, code] of Object.entries(errors ?? {})) {
    if (!(field in {
      productId: true,
      packageId: true,
      fulfillmentDate: true,
      customerName: true,
      mobile: true,
      email: true,
      streetAddress: true,
      postalCode: true,
      city: true,
    })) continue;

    const key = field as ReservationField;
    if (key === "productId") localized[key] = t.selectProduct;
    else if (key === "packageId") localized[key] = t.selectPackage;
    else if (key === "fulfillmentDate") localized[key] = t.selectDate;
    else if (key === "mobile") localized[key] = t.invalidPhone;
    else if (key === "email") localized[key] = t.invalidEmail;
    else if (key === "postalCode") localized[key] = t.invalidPostalCode;
    else if (code === "REQUIRED") localized[key] = t.required;
    else if (key === "customerName" || key === "streetAddress" || key === "city") localized[key] = t.tooShort;
  }

  return localized;
}
