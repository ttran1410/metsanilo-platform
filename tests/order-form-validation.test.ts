import { describe, expect, it } from "vitest";
import { localizeServerFieldErrors, validateReservationFields } from "@/app/[locale]/order-form-validation";

const validPickup = {
  productId: "product-berries",
  packageId: "package-5l",
  fulfillmentDate: "2099-08-13",
  fulfillmentMethod: "PICKUP" as const,
  customerName: "Test Customer",
  mobile: "+358 40 123 4567",
  email: "test@example.com",
  streetAddress: "",
  postalCode: "",
  city: "",
};

describe("reservation form validation", () => {
  it("returns inline errors for every missing required pickup field", () => {
    const errors = validateReservationFields({
      ...validPickup,
      productId: "",
      packageId: "",
      fulfillmentDate: "",
      customerName: "",
      mobile: "",
    }, "en");

    expect(errors).toEqual({
      productId: "Choose a product.",
      packageId: "Choose a package.",
      fulfillmentDate: "Choose a pickup or delivery date.",
      customerName: "This field is required.",
      mobile: "This field is required.",
    });
  });

  it("validates delivery-only and formatted contact fields", () => {
    const errors = validateReservationFields({
      ...validPickup,
      fulfillmentMethod: "DELIVERY",
      mobile: "not-a-number",
      email: "invalid",
      streetAddress: "",
      postalCode: "123",
      city: "P",
    }, "fi");

    expect(errors.mobile).toBe("Anna kelvollinen puhelinnumero.");
    expect(errors.email).toBe("Anna kelvollinen sähköpostiosoite.");
    expect(errors.streetAddress).toBe("Täytä tämä pakollinen kenttä.");
    expect(errors.postalCode).toBe("Anna viisinumeroinen postinumero.");
    expect(errors.city).toBe("Anna vähintään 2 merkkiä.");
  });

  it("turns API error codes into localized field messages", () => {
    expect(localizeServerFieldErrors({ mobile: "INVALID_PHONE", streetAddress: "REQUIRED" }, "en")).toEqual({
      mobile: "Enter a valid phone number.",
      streetAddress: "This field is required.",
    });
  });
});
