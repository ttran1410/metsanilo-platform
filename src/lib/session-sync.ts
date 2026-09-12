export type SessionSyncEvent =
  | { type: "session-touched"; sessionId: string | null; effectiveExpiresAt: string; sentAt: string }
  | { type: "session-revoked"; sessionId: string | null; reason: "idle_timeout" | "absolute_timeout" | "revoked" | "signed_out"; sentAt: string };

export function isSessionSyncEvent(value: unknown): value is SessionSyncEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  if (event.sessionId !== null && typeof event.sessionId !== "string") return false;
  if (typeof event.sentAt !== "string" || !Number.isFinite(Date.parse(event.sentAt))) return false;
  if (event.type === "session-touched") {
    return typeof event.effectiveExpiresAt === "string" && Number.isFinite(Date.parse(event.effectiveExpiresAt));
  }
  if (event.type === "session-revoked") {
    return ["idle_timeout", "absolute_timeout", "revoked", "signed_out"].includes(String(event.reason));
  }
  return false;
}
