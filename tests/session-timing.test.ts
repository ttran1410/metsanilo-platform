import { describe, expect, it } from "vitest";
import {
  evaluateSessionTiming,
  IDLE_TIMEOUT_MS,
  ABSOLUTE_LIFETIME_MS,
  WARNING_THRESHOLD_MS,
  SESSION_TOUCH_THROTTLE_MS,
} from "@/lib/session-timing";

describe("session timing evaluator", () => {
  it("exports expected timing constants", () => {
    expect(IDLE_TIMEOUT_MS).toBe(60 * 60 * 1000); // 60 minutes
    expect(ABSOLUTE_LIFETIME_MS).toBe(8 * 60 * 60 * 1000); // 8 hours
    expect(WARNING_THRESHOLD_MS).toBe(5 * 60 * 1000); // 5 minutes
    expect(SESSION_TOUCH_THROTTLE_MS).toBe(60 * 1000); // 60 seconds
  });

  it("is valid immediately after creation when lastActivityAt is null", () => {
    const createdAt = new Date("2026-09-12T12:00:00.000Z");
    const now = new Date("2026-09-12T12:00:00.000Z");

    const timing = evaluateSessionTiming({ createdAt }, now);

    expect(timing.expired).toBe(false);
    expect(timing.warning).toBe(false);
    expect(timing.idleExpiresAt.toISOString()).toBe("2026-09-12T13:00:00.000Z");
    expect(timing.absoluteExpiresAt.toISOString()).toBe("2026-09-12T20:00:00.000Z");
    expect(timing.effectiveExpiresAt.toISOString()).toBe("2026-09-12T13:00:00.000Z");
    expect(timing.remainingSeconds).toBe(3600);
    expect(timing.expiryReason).toBeNull();
  });

  it("remains valid 59 minutes after last qualifying activity", () => {
    const createdAt = new Date("2026-09-12T12:00:00.000Z");
    const lastActivityAt = new Date("2026-09-12T12:30:00.000Z");
    const now = new Date("2026-09-12T13:29:00.000Z"); // 59 mins after activity

    const timing = evaluateSessionTiming({ createdAt, lastActivityAt }, now);

    expect(timing.expired).toBe(false);
    expect(timing.warning).toBe(true); // 60s remaining <= 5min
    expect(timing.remainingSeconds).toBe(60);
    expect(timing.idleExpiresAt.toISOString()).toBe("2026-09-12T13:30:00.000Z");
  });

  it("expires exactly at the 60-minute idle boundary", () => {
    const createdAt = new Date("2026-09-12T12:00:00.000Z");
    const lastActivityAt = new Date("2026-09-12T12:30:00.000Z");
    const now = new Date("2026-09-12T13:30:00.000Z"); // exactly 60m

    const timing = evaluateSessionTiming({ createdAt, lastActivityAt }, now);

    expect(timing.expired).toBe(true);
    expect(timing.warning).toBe(false);
    expect(timing.remainingSeconds).toBe(0);
    expect(timing.expiryReason).toBe("idle_timeout");
  });

  it("triggers warning state 5 minutes before effective expiry", () => {
    const createdAt = new Date("2026-09-12T12:00:00.000Z");
    const now = new Date("2026-09-12T12:55:00.000Z"); // exactly 5m before 13:00

    const timing = evaluateSessionTiming({ createdAt }, now);

    expect(timing.expired).toBe(false);
    expect(timing.warning).toBe(true);
    expect(timing.remainingSeconds).toBe(300);
  });

  it("touch advances idle expiry up to the absolute 8-hour ceiling", () => {
    const createdAt = new Date("2026-09-12T12:00:00.000Z");
    // Session touched at 7 hours 30 mins into session
    const lastActivityAt = new Date("2026-09-12T19:30:00.000Z");
    const now = new Date("2026-09-12T19:45:00.000Z");

    const timing = evaluateSessionTiming({ createdAt, lastActivityAt }, now);

    expect(timing.expired).toBe(false);
    expect(timing.idleExpiresAt.toISOString()).toBe("2026-09-12T20:30:00.000Z");
    // Absolute expiry caps at 20:00:00
    expect(timing.absoluteExpiresAt.toISOString()).toBe("2026-09-12T20:00:00.000Z");
    expect(timing.effectiveExpiresAt.toISOString()).toBe("2026-09-12T20:00:00.000Z");
    expect(timing.remainingSeconds).toBe(15 * 60);
  });

  it("expires with absolute_timeout when now exceeds 8 hours even if touched recently", () => {
    const createdAt = new Date("2026-09-12T12:00:00.000Z");
    const lastActivityAt = new Date("2026-09-12T19:50:00.000Z");
    const now = new Date("2026-09-12T20:00:01.000Z"); // 1 second after 8 hours

    const timing = evaluateSessionTiming({ createdAt, lastActivityAt }, now);

    expect(timing.expired).toBe(true);
    expect(timing.expiryReason).toBe("absolute_timeout");
  });

  it("respects providerExpiresAt if earlier than 8 hours", () => {
    const createdAt = new Date("2026-09-12T12:00:00.000Z");
    const providerExpiresAt = new Date("2026-09-12T15:00:00.000Z"); // 3 hours
    const lastActivityAt = new Date("2026-09-12T14:40:00.000Z"); // idle would be 15:40
    const now = new Date("2026-09-12T14:50:00.000Z");

    const timing = evaluateSessionTiming({ createdAt, lastActivityAt, providerExpiresAt }, now);

    expect(timing.effectiveExpiresAt.toISOString()).toBe("2026-09-12T15:00:00.000Z");
  });

  it("fails closed on invalid createdAt timestamp", () => {
    const timing = evaluateSessionTiming({ createdAt: "invalid-date" });
    expect(timing.expired).toBe(true);
    expect(timing.remainingSeconds).toBe(0);
  });

  it("fails closed when the evaluation clock is invalid", () => {
    const timing = evaluateSessionTiming({ createdAt: new Date("2026-09-12T12:00:00.000Z") }, Number.NaN);
    expect(timing.expired).toBe(true);
    expect(timing.remainingSeconds).toBe(0);
  });

  it.each([
    ["lastActivityAt before creation", { lastActivityAt: new Date("2026-09-11T12:00:00.000Z") }],
    ["lastActivityAt after absolute ceiling", { lastActivityAt: new Date("2026-09-13T12:01:00.000Z") }],
    ["provider expiry before creation", { providerExpiresAt: new Date("2026-09-11T12:00:00.000Z") }],
  ])("fails closed on invalid timestamp ordering: %s", (_label, extra) => {
    const timing = evaluateSessionTiming({ createdAt: new Date("2026-09-12T12:00:00.000Z"), ...extra });
    expect(timing.expired).toBe(true);
    expect(timing.remainingSeconds).toBe(0);
  });
});
