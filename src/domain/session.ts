import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "metsanilo_session";
const TTL_SECONDS = 60 * 60 * 8;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "local-development-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSession(email: string, sessionVersion = 1, mustChangePassword = false) {
  const payload = Buffer.from(JSON.stringify({ email, sessionVersion, mustChangePassword, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(value: string | undefined) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; sessionVersion?: number; mustChangePassword?: boolean; exp?: number };
    return parsed.email && parsed.exp && parsed.exp > Math.floor(Date.now() / 1000) ? { email: parsed.email, sessionVersion: parsed.sessionVersion ?? 1, mustChangePassword: parsed.mustChangePassword === true } : null;
  } catch { return null; }
}

export const sessionMaxAge = TTL_SECONDS;
