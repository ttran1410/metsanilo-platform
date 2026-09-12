import { createHmac, timingSafeEqual } from "node:crypto";
import { evaluateSessionTiming, type SessionTiming } from "@/lib/session-timing";

export const SESSION_COOKIE = "metsanilo_session";
const TTL_SECONDS = 60 * 60 * 8; // 8 hours absolute lifetime

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "local-development-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export type LegacySessionV1 = {
  email: string;
  sessionVersion: number;
  mustChangePassword?: boolean;
  exp: number; // Unix seconds
};

export type LegacySessionV2 = {
  version: 2;
  email: string;
  sessionVersion: number;
  mustChangePassword: boolean;
  issuedAt: number; // Unix seconds
  lastActivityAt: number; // Unix seconds
  exp: number; // Unix seconds
};

export type ParsedLegacySession = {
  version: 1 | 2;
  email: string;
  sessionVersion: number;
  mustChangePassword: boolean;
  issuedAt: number; // Unix seconds
  lastActivityAt: number; // Unix seconds
  exp: number; // Unix seconds
  timing: SessionTiming;
};

export function createSession(
  email: string,
  sessionVersion = 1,
  mustChangePassword = false,
  nowSec: number = Math.floor(Date.now() / 1000)
): string {
  const payloadObj: LegacySessionV2 = {
    version: 2,
    email,
    sessionVersion,
    mustChangePassword,
    issuedAt: nowSec,
    lastActivityAt: nowSec,
    exp: nowSec + TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function touchLegacySession(
  session: ParsedLegacySession,
  nowSec: number = Math.floor(Date.now() / 1000)
): string | null {
  if (session.timing.expired || nowSec >= Math.floor(session.timing.effectiveExpiresAt.getTime() / 1000)) {
    return null;
  }
  const payloadObj: LegacySessionV2 = {
    version: 2,
    email: session.email,
    sessionVersion: session.sessionVersion,
    mustChangePassword: session.mustChangePassword,
    issuedAt: session.issuedAt,
    lastActivityAt: nowSec,
    exp: session.exp,
  };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(
  value: string | undefined,
  nowSec: number = Math.floor(Date.now() / 1000)
): ParsedLegacySession | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!raw || typeof raw !== "object" || typeof raw.email !== "string") return null;

    let version: 1 | 2 = 1;
    let issuedAt: number;
    let lastActivityAt: number;
    let exp: number;
    const sessionVersion = typeof raw.sessionVersion === "number" ? raw.sessionVersion : 1;
    const mustChangePassword = raw.mustChangePassword === true;

    if (
      raw.version === 2 &&
      typeof raw.issuedAt === "number" &&
      typeof raw.lastActivityAt === "number" &&
      typeof raw.exp === "number"
    ) {
      version = 2;
      issuedAt = raw.issuedAt;
      lastActivityAt = raw.lastActivityAt;
      exp = raw.exp;
    } else if (typeof raw.exp === "number") {
      version = 1;
      issuedAt = raw.exp - TTL_SECONDS;
      lastActivityAt = issuedAt; // Compatibility baseline: issuedAt = exp - 8h, lastActivityAt = issuedAt
      exp = raw.exp;
    } else {
      return null;
    }

    const timing = evaluateSessionTiming(
      {
        createdAt: new Date(issuedAt * 1000),
        lastActivityAt: new Date(lastActivityAt * 1000),
        providerExpiresAt: new Date(exp * 1000),
      },
      new Date(nowSec * 1000)
    );

    if (timing.expired) return null;

    return {
      version,
      email: raw.email,
      sessionVersion,
      mustChangePassword,
      issuedAt,
      lastActivityAt,
      exp,
      timing,
    };
  } catch {
    return null;
  }
}

export const sessionMaxAge = TTL_SECONDS;
