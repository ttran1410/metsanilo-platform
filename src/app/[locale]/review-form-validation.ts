import type { Locale } from "@/lib/format";
import { customerValidationCopy } from "./customer-form-validation";

export type ReviewField = "name" | "rating" | "review";

export function validateReviewFields(values: { name: string; rating: number; review: string }, locale: Locale) {
  const t = customerValidationCopy[locale];
  const errors: Partial<Record<ReviewField, string>> = {};
  const name = values.name.trim();
  const review = values.review.trim();

  if (!name) errors.name = t.required;
  if (values.rating < 1 || values.rating > 5) errors.rating = t.selectRating;
  if (!review) errors.review = t.required;
  else if (review.length < 10) errors.review = t.reviewTooShort;

  return errors;
}
