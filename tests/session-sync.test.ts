import { describe, expect, it } from "vitest";
import { isSessionSyncEvent } from "@/lib/session-sync";

describe("session sync event validation", () => {
  it("accepts valid touch and revoke events", () => {
    expect(isSessionSyncEvent({ type: "session-touched", sessionId: "s1", effectiveExpiresAt: "2026-09-12T13:00:00.000Z", sentAt: "2026-09-12T12:00:00.000Z" })).toBe(true);
    expect(isSessionSyncEvent({ type: "session-revoked", sessionId: null, reason: "signed_out", sentAt: "2026-09-12T12:00:00.000Z" })).toBe(true);
  });

  it.each([
    null,
    { type: "session-touched", sessionId: "s1", effectiveExpiresAt: "invalid", sentAt: "2026-09-12T12:00:00.000Z" },
    { type: "session-revoked", sessionId: "s1", reason: "unknown", sentAt: "2026-09-12T12:00:00.000Z" },
    { type: "session-revoked", sessionId: 42, reason: "revoked", sentAt: "2026-09-12T12:00:00.000Z" },
  ])("rejects malformed event %#", (event) => expect(isSessionSyncEvent(event)).toBe(false));
});
