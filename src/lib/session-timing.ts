export const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
export const ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours
export const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
export const SESSION_TOUCH_THROTTLE_MS = 60 * 1000; // 60 seconds

export type SessionTimingInput = {
  createdAt: Date | number | string;
  lastActivityAt?: Date | number | string | null;
  providerExpiresAt?: Date | number | string | null;
};

export type SessionTiming = {
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  effectiveExpiresAt: Date;
  remainingSeconds: number;
  warning: boolean;
  expired: boolean;
  expiryReason: "idle_timeout" | "absolute_timeout" | null;
};

function parseTimestamp(value: Date | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function evaluateSessionTiming(
  input: SessionTimingInput,
  now: Date | number = new Date()
): SessionTiming {
  const nowMs = typeof now === "number" ? now : now.getTime();
  const createdMs = parseTimestamp(input.createdAt);

  if (createdMs === null || !Number.isFinite(nowMs)) {
    // Fail closed if creation time is invalid
    const epoch = new Date(0);
    return {
      idleExpiresAt: epoch,
      absoluteExpiresAt: epoch,
      effectiveExpiresAt: epoch,
      remainingSeconds: 0,
      warning: false,
      expired: true,
      expiryReason: "absolute_timeout",
    };
  }

  const lastActivityMs = parseTimestamp(input.lastActivityAt);
  const providerExpiresMs = parseTimestamp(input.providerExpiresAt);

  const maxAbsoluteMs = createdMs + ABSOLUTE_LIFETIME_MS;
  if (
    (lastActivityMs !== null && (lastActivityMs < createdMs || lastActivityMs > maxAbsoluteMs)) ||
    (providerExpiresMs !== null && providerExpiresMs < createdMs)
  ) {
    const epoch = new Date(0);
    return {
      idleExpiresAt: epoch,
      absoluteExpiresAt: epoch,
      effectiveExpiresAt: epoch,
      remainingSeconds: 0,
      warning: false,
      expired: true,
      expiryReason: "absolute_timeout",
    };
  }

  const activityBaselineMs = lastActivityMs ?? createdMs;
  const idleExpiresMs = activityBaselineMs + IDLE_TIMEOUT_MS;

  const absoluteExpiresMs =
    providerExpiresMs !== null
      ? Math.min(providerExpiresMs, maxAbsoluteMs)
      : maxAbsoluteMs;

  const effectiveExpiresMs = Math.min(idleExpiresMs, absoluteExpiresMs);
  const expired = nowMs >= effectiveExpiresMs;
  const remainingMs = Math.max(0, effectiveExpiresMs - nowMs);
  const remainingSeconds = Math.floor(remainingMs / 1000);
  const warning = !expired && remainingMs <= WARNING_THRESHOLD_MS;

  let expiryReason: "idle_timeout" | "absolute_timeout" | null = null;
  if (expired) {
    expiryReason = idleExpiresMs <= absoluteExpiresMs ? "idle_timeout" : "absolute_timeout";
  }

  return {
    idleExpiresAt: new Date(idleExpiresMs),
    absoluteExpiresAt: new Date(absoluteExpiresMs),
    effectiveExpiresAt: new Date(effectiveExpiresMs),
    remainingSeconds,
    warning,
    expired,
    expiryReason,
  };
}
