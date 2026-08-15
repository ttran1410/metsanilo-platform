import { describe, expect, it } from "vitest";
import { validateReviewFields } from "@/app/[locale]/review-form-validation";

describe("review form validation", () => {
  it("returns the same localized required-field style as the reservation form", () => {
    expect(validateReviewFields({ name: "", rating: 0, review: "" }, "en")).toEqual({
      name: "This field is required.",
      rating: "Choose a star rating.",
      review: "This field is required.",
    });
  });

  it("requires a meaningful review and accepts a complete submission", () => {
    expect(validateReviewFields({ name: "Liisa", rating: 5, review: "Too short" }, "fi")).toEqual({
      review: "Kirjoita vähintään 10 merkkiä.",
    });
    expect(validateReviewFields({ name: "Liisa", rating: 5, review: "Erinomainen palvelu!" }, "fi")).toEqual({});
  });
});
