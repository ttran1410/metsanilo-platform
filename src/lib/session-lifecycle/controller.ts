import type { SessionSyncEvent } from "@/lib/session-sync";
import type {
  ClockPort, NavigationPort, OutboundSessionSyncEvent, SessionExpiryReason, SessionLifecycleState,
  SessionStatusSnapshot, SessionSyncBusPort, SessionTransportPort, TimerPort,
} from "./types";

const WARNING_SECONDS = 300;
const TOUCH_THROTTLE_MS = 60_000;

type Options = {
  clock: ClockPort;
  timer: TimerPort;
  transport: SessionTransportPort;
  syncBus: SessionSyncBusPort;
  navigation: NavigationPort;
  nextUrl: string;
};

export class SessionLifecycleController {
  private state: SessionLifecycleState = {
    status: "idle", currentSessionId: null, effectiveExpiresAt: null, remainingSeconds: null,
    clockOffsetMs: 0, lastTouchAttemptMs: null, isExtending: false, isWarningOpen: false,
    expiryReason: null, announcement: "", hasNavigated: false,
  };
  private listeners = new Set<(state: SessionLifecycleState) => void>();
  private timerHandle: unknown = null;
  private unsubscribe: (() => void) | null = null;
  private started = false;
  private disposed = false;
  private requestSequence = 0;
  private latestStatusSequence = 0;
  private latestTouchSequence = 0;
  private pendingTouch: Promise<void> | null = null;
  private seenEvents = new Map<string, number>();

  constructor(private readonly options: Options) {}

  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.unsubscribe = this.options.syncBus.subscribe((event) => this.handleSyncEvent(event));
    void this.refreshStatus();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timerHandle !== null) this.options.timer.clearInterval(this.timerHandle);
    this.timerHandle = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }

  getState() { return this.state; }
  subscribe(listener: (state: SessionLifecycleState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async refreshStatus() {
    if (this.disposed || this.pendingTouch) return;
    const sequence = ++this.requestSequence;
    this.latestStatusSequence = sequence;
    try {
      const snapshot = await this.options.transport.fetchStatus();
      if (this.disposed || sequence !== this.latestStatusSequence || this.pendingTouch) return;
      this.commitSnapshot(snapshot);
    } catch (error) {
      this.handleTransportError(error);
    }
  }

  handleActivity() {
    if (this.disposed || this.state.status === "expired" || this.state.status === "revoked") return;
    const now = this.options.clock.now();
    if (this.state.lastTouchAttemptMs !== null && now - this.state.lastTouchAttemptMs < TOUCH_THROTTLE_MS) return;
    void this.touch(false);
  }

  extendSession() { return this.touch(true); }

  private touch(explicit: boolean) {
    if (this.disposed || this.state.status === "expired" || this.state.status === "revoked") return Promise.resolve();
    if (this.pendingTouch) return this.pendingTouch;
    if (!explicit && this.state.lastTouchAttemptMs !== null && this.options.clock.now() - this.state.lastTouchAttemptMs < TOUCH_THROTTLE_MS) return Promise.resolve();
    const sequence = ++this.requestSequence;
    this.latestTouchSequence = sequence;
    this.state = { ...this.state, isExtending: true, lastTouchAttemptMs: this.options.clock.now() };
    this.emit();
    this.pendingTouch = this.options.transport.touch().then((snapshot) => {
      if (!this.disposed && sequence === this.latestTouchSequence) {
        this.commitSnapshot(snapshot);
        if (snapshot.currentSessionId) this.options.syncBus.publish({
          type: "session-touched", eventId: createEventId(), sessionId: snapshot.currentSessionId,
          effectiveExpiresAt: snapshot.effectiveExpiresAt, sentAt: new Date().toISOString(),
        });
      }
    }).catch((error) => this.handleTransportError(error)).finally(() => {
      this.pendingTouch = null;
      if (!this.disposed) { this.state = { ...this.state, isExtending: false }; this.emit(); }
    });
    return this.pendingTouch;
  }

  async signOut() {
    if (this.disposed || this.state.hasNavigated) return;
    this.requestSequence++;
    this.latestStatusSequence = this.requestSequence;
    this.latestTouchSequence = this.requestSequence;
    this.transitionTerminal("revoked", "signed_out", true);
    await this.options.transport.signOut().catch(() => undefined);
  }

  private commitSnapshot(snapshot: SessionStatusSnapshot) {
    const serverNow = Date.parse(snapshot.serverNow);
    const expiresAt = Date.parse(snapshot.effectiveExpiresAt);
    if (!Number.isFinite(serverNow) || !Number.isFinite(expiresAt)) return;
    if (this.state.currentSessionId !== null && snapshot.currentSessionId !== this.state.currentSessionId) return;
    const remaining = Math.max(0, Math.floor((expiresAt - (this.options.clock.now() + serverNow - this.options.clock.now())) / 1000));
    this.state = { ...this.state, currentSessionId: snapshot.currentSessionId, clockOffsetMs: serverNow - this.options.clock.now(), effectiveExpiresAt: snapshot.effectiveExpiresAt, remainingSeconds: remaining, expiryReason: snapshot.expiryReason, status: remaining <= 0 ? "expired" : remaining <= WARNING_SECONDS ? "warning" : "active", isWarningOpen: remaining > 0 && remaining <= WARNING_SECONDS };
    if (remaining <= 0) this.transitionTerminal("expired", snapshot.expiryReason ?? "idle_timeout", true);
    else this.ensureTimer();
    this.emit();
  }

  private ensureTimer() {
    if (this.timerHandle !== null) return;
    this.timerHandle = this.options.timer.setInterval(() => this.tick(), 1000);
  }

  private tick() {
    if (this.disposed || !this.state.effectiveExpiresAt) return;
    const remaining = Math.max(0, Math.floor((Date.parse(this.state.effectiveExpiresAt) - (this.options.clock.now() + this.state.clockOffsetMs)) / 1000));
    if (remaining <= 0) { this.transitionTerminal("expired", this.state.expiryReason ?? "idle_timeout", true); return; }
    const warning = remaining <= WARNING_SECONDS;
    const minute = Math.ceil(remaining / 60);
    const announcement = warning && (remaining % 15 === 0 || remaining > 60 && remaining % 60 === 0)
      ? `Your session will expire in ${remaining > 60 ? minute + " minutes" : remaining + " seconds"}.` : this.state.announcement;
    this.state = { ...this.state, remainingSeconds: remaining, status: warning ? "warning" : "active", isWarningOpen: warning, announcement };
    this.emit();
  }

  private handleSyncEvent(event: SessionSyncEvent) {
    if (this.disposed) return;
    const now = this.options.clock.now();
    for (const [id, time] of this.seenEvents) if (now - time > 300_000) this.seenEvents.delete(id);
    const id = event.eventId ?? `${event.type}:${event.sessionId}:${event.sentAt}:${"reason" in event ? event.reason : event.effectiveExpiresAt}`;
    if (this.seenEvents.has(id)) return;
    this.seenEvents.set(id, now);
    if (this.state.currentSessionId === null || event.sessionId !== this.state.currentSessionId) return;
    if (event.type === "session-revoked") this.transitionTerminal("revoked", event.reason, false);
    else if (Date.parse(event.effectiveExpiresAt) > Date.parse(this.state.effectiveExpiresAt ?? "")) {
      const remaining = Math.max(0, Math.floor((Date.parse(event.effectiveExpiresAt) - (now + this.state.clockOffsetMs)) / 1000));
      this.state = { ...this.state, effectiveExpiresAt: event.effectiveExpiresAt, remainingSeconds: remaining, status: remaining <= WARNING_SECONDS ? "warning" : "active", isWarningOpen: remaining > 0 && remaining <= WARNING_SECONDS };
      this.ensureTimer();
      this.emit();
    }
  }

  private transitionTerminal(status: "expired" | "revoked", reason: SessionExpiryReason, publish: boolean) {
    if (this.state.hasNavigated || this.disposed) return;
    if (this.timerHandle !== null) this.options.timer.clearInterval(this.timerHandle);
    this.timerHandle = null;
    this.state = { ...this.state, status, expiryReason: reason, isWarningOpen: false, isExtending: false, hasNavigated: true };
    if (publish && this.state.currentSessionId) {
      const event: OutboundSessionSyncEvent = { type: "session-revoked", eventId: createEventId(), sessionId: this.state.currentSessionId, reason, sentAt: new Date().toISOString() };
      this.options.syncBus.publish(event);
    }
    this.options.navigation.redirectToLogin({ reason, nextUrl: this.options.nextUrl });
    this.emit();
  }

  private handleTransportError(error: unknown) {
    const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: unknown }).status) : 0;
    if (status === 401 || status === 403) this.transitionTerminal("revoked", "revoked", true);
  }

  private emit() { if (!this.disposed) for (const listener of this.listeners) listener(this.state); }
}

function createEventId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
