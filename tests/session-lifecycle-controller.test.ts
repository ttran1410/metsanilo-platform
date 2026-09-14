import { describe, expect, it } from "vitest";
import { SessionLifecycleController } from "@/lib/session-lifecycle/controller";
import type { SessionSyncEvent } from "@/lib/session-sync";
import type { SessionStatusSnapshot } from "@/lib/session-lifecycle/types";

const snapshot = (id: string | null = "s1", expires = "2026-09-14T12:10:00.000Z"): SessionStatusSnapshot => ({
  mechanism: "better_auth", currentSessionId: id, serverNow: "2026-09-14T12:00:00.000Z",
  idleExpiresAt: expires, absoluteExpiresAt: "2026-09-14T20:00:00.000Z", effectiveExpiresAt: expires,
  expiryReason: null, remainingSeconds: 600, warning: false,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

class FakeTransport {
  status: Promise<SessionStatusSnapshot> = Promise.resolve(snapshot());
  statusSequence: Promise<SessionStatusSnapshot>[] = [];
  statusCalls = 0;
  touches = 0;
  async fetchStatus() { this.statusCalls += 1; return this.statusSequence.shift() ?? this.status; }
  async touch() { this.touches += 1; return snapshot(); }
  async signOut() { return undefined; }
}

function make() {
  let now = Date.parse("2026-09-14T12:00:00.000Z");
  const transport = new FakeTransport();
  const handlers = new Set<(event: SessionSyncEvent) => void>();
  const redirects: unknown[] = [];
  const published: unknown[] = [];
  let timerStarts = 0;
  let closeCalls = 0;
  const syncBus = { publish: (event: unknown) => published.push(event), subscribe: (handler: (event: SessionSyncEvent) => void) => { handlers.add(handler); return () => handlers.delete(handler); }, close: () => { closeCalls += 1; } };
  const controller = new SessionLifecycleController({
    clock: { now: () => now },
    timer: { setInterval: () => { timerStarts += 1; return 1; }, clearInterval: () => undefined },
    transport,
    syncBus,
    navigation: { redirectToLogin: (input) => redirects.push(input) },
    nextUrl: "/admin/dashboard",
  });
  return { controller, transport, handlers, redirects, published, getTimerStarts: () => timerStarts, getCloseCalls: () => closeCalls, advance: (ms: number) => { now += ms; } };
}

describe("SessionLifecycleController", () => {
  it("establishes identity from the initial status response", async () => {
    const { controller } = make();
    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(controller.getState().currentSessionId).toBe("s1");
    expect(controller.getState().status).toBe("active");
  });

  it("keeps the controller in bootstrap idle state without a session identity", async () => {
    const { controller, transport, getTimerStarts } = make();
    transport.statusSequence = [Promise.resolve(snapshot(null)), Promise.resolve(snapshot(null))];
    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(transport.statusCalls).toBe(2);
    expect(controller.getState().currentSessionId).toBeNull();
    expect(controller.getState().status).toBe("bootstrapping");
    expect(controller.getState().remainingSeconds).toBeNull();
    expect(getTimerStarts()).toBe(0);
  });

  it("starts the lifecycle only after bootstrap refresh establishes identity", async () => {
    const { controller, transport, getTimerStarts } = make();
    transport.statusSequence = [Promise.resolve(snapshot(null)), Promise.resolve(snapshot("s1"))];
    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(transport.statusCalls).toBe(2);
    expect(controller.getState().currentSessionId).toBe("s1");
    expect(controller.getState().status).toBe("active");
    expect(getTimerStarts()).toBe(1);
  });

  it("runs the mandatory bootstrap refresh deterministically", async () => {
    const { controller, transport, getTimerStarts } = make();
    const first = deferred<SessionStatusSnapshot>();
    const second = deferred<SessionStatusSnapshot>();
    transport.statusSequence = [first.promise, second.promise];
    controller.start();
    expect(transport.statusCalls).toBe(1);
    first.resolve(snapshot(null));
    await flush();
    expect(transport.statusCalls).toBe(2);
    expect(getTimerStarts()).toBe(0);
    second.resolve(snapshot("s1"));
    await flush();
    expect(getTimerStarts()).toBe(1);
    expect(controller.getState().currentSessionId).toBe("s1");
  });

  it("does not commit a stale status response after a newer touch", async () => {
    const { controller, transport } = make();
    controller.start(); await flush();
    const staleStatus = deferred<SessionStatusSnapshot>();
    transport.statusSequence = [staleStatus.promise];
    const statusRequest = controller.refreshStatus();
    transport.touch = async () => snapshot("s1", "2026-09-14T12:30:00.000Z");
    await controller.extendSession();
    staleStatus.resolve(snapshot("s1", "2026-09-14T12:11:00.000Z"));
    await statusRequest;
    expect(controller.getState().effectiveExpiresAt).toBe("2026-09-14T12:30:00.000Z");
  });

  it("does not overwrite an active session with a null revalidation response", async () => {
    const { controller, transport } = make();
    controller.start(); await flush();
    transport.status = Promise.resolve(snapshot(null));
    await controller.refreshStatus();
    expect(controller.getState().currentSessionId).toBe("s1");
    expect(controller.getState().status).toBe("active");
  });

  it("does not touch while bootstrap is unresolved", () => {
    const { controller, transport } = make();
    transport.statusSequence = [new Promise<SessionStatusSnapshot>(() => undefined)];
    controller.start();
    controller.handleActivity();
    expect(transport.touches).toBe(0);
    expect(controller.getState().status).toBe("bootstrapping");
  });

  it("does not explicitly extend while bootstrapping", async () => {
    const { controller, transport } = make();
    transport.statusSequence = [new Promise<SessionStatusSnapshot>(() => undefined)];
    controller.start();
    await controller.extendSession();
    expect(transport.touches).toBe(0);
    expect(controller.getState().status).toBe("bootstrapping");
  });

  it("does not replace a known session identity with null", async () => {
    const { controller, transport } = make();
    controller.start(); await new Promise((resolve) => setTimeout(resolve, 0));
    transport.status = Promise.resolve(snapshot(null));
    await controller.refreshStatus();
    expect(controller.getState().currentSessionId).toBe("s1");
  });

  it("throttles activity touches", async () => {
    const { controller, transport, advance } = make();
    controller.start(); await new Promise((resolve) => setTimeout(resolve, 0));
    controller.handleActivity(); controller.handleActivity(); await Promise.resolve();
    expect(transport.touches).toBe(1);
    advance(59_999); controller.handleActivity();
    expect(transport.touches).toBe(1);
  });

  it("ignores a status response from a different session", async () => {
    const { controller, transport } = make();
    controller.start(); await new Promise((resolve) => setTimeout(resolve, 0));
    transport.status = Promise.resolve(snapshot("other"));
    await controller.refreshStatus();
    expect(controller.getState().currentSessionId).toBe("s1");
  });

  it("navigates only once for repeated remote revoke events", async () => {
    const { controller, handlers, redirects } = make();
    controller.start(); await new Promise((resolve) => setTimeout(resolve, 0));
    const event = { type: "session-revoked", eventId: "e1", sessionId: "s1", reason: "revoked", sentAt: "2026-09-14T12:01:00.000Z" } as const;
    for (const handler of handlers) { handler(event); handler(event); }
    expect(redirects).toHaveLength(1);
    expect(controller.getState().status).toBe("revoked");
  });

  it("uses the latest next URL when navigating", async () => {
    const { controller, handlers, redirects } = make();
    controller.start(); await new Promise((resolve) => setTimeout(resolve, 0));
    controller.setNextUrl("/admin/orders?page=2");
    for (const handler of handlers) handler({ type: "session-revoked", eventId: "e2", sessionId: "s1", reason: "revoked", sentAt: "2026-09-14T12:01:00.000Z" });
    expect(redirects).toEqual([{ reason: "revoked", nextUrl: "/admin/orders?page=2" }]);
  });

  it("does not publish a touch event after an expired touch response", async () => {
    const { controller, transport, published } = make();
    controller.start(); await new Promise((resolve) => setTimeout(resolve, 0));
    transport.touch = async () => snapshot("s1", "2026-09-14T11:59:00.000Z");
    await controller.extendSession();
    expect(published.some((event) => (event as { type?: string }).type === "session-touched")).toBe(false);
  });

  it("closes the sync bus when disposed", async () => {
    const { controller, getCloseCalls } = make();
    controller.start(); await flush();
    controller.dispose(); controller.dispose();
    expect(getCloseCalls()).toBe(1);
  });
});
