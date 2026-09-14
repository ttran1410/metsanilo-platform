import type { SessionSyncEvent } from "@/lib/session-sync";

export type SessionExpiryReason = "idle_timeout" | "absolute_timeout" | "revoked" | "signed_out";
export type SessionStatus = "idle" | "active" | "warning" | "expired" | "revoked";

export type SessionStatusSnapshot = {
  mechanism: "better_auth";
  currentSessionId: string | null;
  serverNow: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  effectiveExpiresAt: string;
  expiryReason: "idle_timeout" | "absolute_timeout" | null;
  remainingSeconds: number;
  warning: boolean;
};

export type ClockPort = { now(): number };
export type TimerPort = {
  setInterval(callback: () => void, delayMs: number): unknown;
  clearInterval(handle: unknown): void;
};
export type SessionTransportPort = {
  fetchStatus(): Promise<SessionStatusSnapshot>;
  touch(): Promise<SessionStatusSnapshot>;
  signOut(): Promise<void>;
};
export type OutboundSessionSyncEvent =
  | { type: "session-touched"; eventId: string; sessionId: string; effectiveExpiresAt: string; sentAt: string }
  | { type: "session-revoked"; eventId: string; sessionId: string; reason: SessionExpiryReason; sentAt: string };
export type SessionSyncBusPort = {
  publish(event: OutboundSessionSyncEvent): void;
  subscribe(handler: (event: SessionSyncEvent) => void): () => void;
  close(): void;
};
export type NavigationPort = {
  redirectToLogin(input: { reason: SessionExpiryReason; nextUrl: string }): void;
};

export type SessionLifecycleState = {
  status: SessionStatus;
  currentSessionId: string | null;
  effectiveExpiresAt: string | null;
  remainingSeconds: number | null;
  clockOffsetMs: number;
  lastTouchAttemptMs: number | null;
  isExtending: boolean;
  isWarningOpen: boolean;
  expiryReason: SessionExpiryReason | null;
  announcement: string;
  hasNavigated: boolean;
};
