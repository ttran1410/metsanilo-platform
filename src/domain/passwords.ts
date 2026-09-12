import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
export function assertPassword(value: string) { if (!PASSWORD_RULE.test(value)) throw new Error("Password must be at least 8 characters and include uppercase, lowercase, number, and special character"); }
export function hashPassword(password: string) { assertPassword(password); const salt = randomBytes(16).toString("hex"); return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }
export function verifyPassword(password: string, encoded: string) { const [scheme, salt, digest] = encoded.split(":"); if (scheme !== "scrypt" || !salt || !digest) return false; const actual = scryptSync(password, salt, 64); const expected = Buffer.from(digest, "hex"); return actual.length === expected.length && timingSafeEqual(actual, expected); }
export function isSupportedPasswordHash(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) return false;
  return /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/i.test(value);
}
export function randomPassword(length = 16) {
  const targetLength = Math.max(length, 12);
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const charsLen = chars.length;
  const maxValidByte = 256 - (256 % charsLen);
  let value = "";
  while (value.length < targetLength) {
    const byte = randomBytes(1)[0];
    if (byte < maxValidByte) {
      value += chars[byte % charsLen];
    }
  }
  if (!PASSWORD_RULE.test(value)) return randomPassword(targetLength);
  return value;
}
