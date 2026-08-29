"use client";

import type { Locale } from "@/lib/format";
import { CustomerFieldError } from "./[locale]/customer-form-validation";

export type CustomerAddressFieldsProps = {
  fulfillmentMethod?: "PICKUP" | "DELIVERY" | string;
  streetAddress?: string;
  postalCode?: string;
  city?: string;
  onStreetAddressChange?: (value: string) => void;
  onPostalCodeChange?: (value: string) => void;
  onCityChange?: (value: string) => void;
  fieldErrors?: { streetAddress?: string; postalCode?: string; city?: string };
  locale?: Locale;
  disabled?: boolean;
  className?: string;
  legend?: string;
  showFieldsetWrapper?: boolean;
};

export function CustomerAddressFields({
  fulfillmentMethod = "PICKUP",
  streetAddress,
  postalCode,
  city,
  onStreetAddressChange,
  onPostalCodeChange,
  onCityChange,
  fieldErrors,
  locale = "en",
  disabled = false,
  className = "",
  legend,
  showFieldsetWrapper = false,
}: CustomerAddressFieldsProps) {
  const isDelivery = fulfillmentMethod === "DELIVERY";
  const streetLabel = locale === "en" ? "Street address" : "Katuosoite";
  const postalLabel = locale === "en" ? "Postal code" : "Postinumero";
  const cityLabel = locale === "en" ? "City" : "Postitoimipaikka";

  const gridContent = (
    <div className={`customer-address-grid ${className}`}>
      {/* Street address: Line 1 on mobile (100%), left 50% on desktop */}
      <label className={`field customer-address-street${fieldErrors?.streetAddress ? " field-invalid" : ""}`} data-field="streetAddress">
        <span>{streetLabel}</span>
        <input
          name="streetAddress"
          value={streetAddress}
          onChange={(e) => onStreetAddressChange?.(e.target.value)}
          required={isDelivery}
          minLength={2}
          maxLength={160}
          disabled={disabled}
          placeholder={isDelivery ? (locale === "en" ? "Required for delivery" : "Pakollinen toimitukselle") : (locale === "en" ? "Optional for pickup" : "Valinnainen noudolle")}
          aria-invalid={Boolean(fieldErrors?.streetAddress)}
          aria-describedby={fieldErrors?.streetAddress ? "streetAddress-error" : undefined}
        />
        {fieldErrors?.streetAddress && <CustomerFieldError field="streetAddress" error={fieldErrors.streetAddress} />}
      </label>

      {/* Postal code: Line 2 left on mobile (~40%), ~17% on desktop */}
      <label className={`field customer-address-postal${fieldErrors?.postalCode ? " field-invalid" : ""}`} data-field="postalCode">
        <span>{postalLabel}</span>
        <input
          name="postalCode"
          inputMode="numeric"
          pattern="[0-9]{5}"
          maxLength={5}
          value={postalCode}
          onChange={(e) => onPostalCodeChange?.(e.target.value)}
          disabled={disabled}
          placeholder="28100"
          aria-invalid={Boolean(fieldErrors?.postalCode)}
          aria-describedby={fieldErrors?.postalCode ? "postalCode-error" : undefined}
        />
        {fieldErrors?.postalCode && <CustomerFieldError field="postalCode" error={fieldErrors.postalCode} />}
      </label>

      {/* City: Line 2 right on mobile (~60%), ~33% on desktop */}
      <label className={`field customer-address-city${fieldErrors?.city ? " field-invalid" : ""}`} data-field="city">
        <span>{cityLabel}</span>
        <input
          name="city"
          value={city}
          onChange={(e) => onCityChange?.(e.target.value)}
          minLength={2}
          maxLength={100}
          disabled={disabled}
          placeholder="Pori"
          aria-invalid={Boolean(fieldErrors?.city)}
          aria-describedby={fieldErrors?.city ? "city-error" : undefined}
        />
        {fieldErrors?.city && <CustomerFieldError field="city" error={fieldErrors.city} />}
      </label>
    </div>
  );

  if (showFieldsetWrapper) {
    return (
      <fieldset className="customer-address-fieldset w-full rounded-xl border border-line p-4 space-y-2 bg-surface-muted/30">
        {legend && <legend className="text-xs font-bold uppercase tracking-wider text-muted px-1.5">{legend}</legend>}
        {gridContent}
      </fieldset>
    );
  }

  return gridContent;
}
