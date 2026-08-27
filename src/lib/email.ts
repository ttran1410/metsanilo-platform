import { z } from "zod";

export const emailSchema = z.string().email().max(254);

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string) {
  const normalized = normalizeEmail(value);
  const result = emailSchema.safeParse(normalized);
  return result.success ? { email: normalized } : { error: "Enter a valid email address, such as name@example.com." };
}
