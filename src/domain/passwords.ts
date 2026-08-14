import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
export function assertPassword(value: string) { if (!PASSWORD_RULE.test(value)) throw new Error("Password must be at least 8 characters and include uppercase, lowercase, number, and special character"); }
export function hashPassword(password: string) { assertPassword(password); const salt = randomBytes(16).toString("hex"); return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }
export function verifyPassword(password: string, encoded: string) { const [scheme, salt, digest] = encoded.split(":"); if (scheme !== "scrypt" || !salt || !digest) return false; const actual = scryptSync(password, salt, 64); const expected = Buffer.from(digest, "hex"); return actual.length === expected.length && timingSafeEqual(actual, expected); }
export function randomPassword() { const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%"; let value = ""; for (let index = 0; index < 12; index += 1) value += chars[randomBytes(1)[0] % chars.length]; if (!PASSWORD_RULE.test(value)) return randomPassword(); return value; }
