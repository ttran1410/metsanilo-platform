import { describe, expect, it } from "vitest";
import { SessionLifecycleController } from "@/lib/session-lifecycle/controller";
import type { SessionSyncEvent } from "@/lib/session-sync";
import type { SessionStatusSnapshot } from "@/lib/session-lifecycle/types";

const snapshot = (id = "s1", expires = "2026-09-14T12:10:00.000Z"): SessionStatusSnapshot => ({
  mechanism: "better_auth", currentSessionId: id, serverNow: "2026-09-14T12:00:00.000Z",
  idleExpiresAt: expires, absoluteExpiresAt: "2026-09-14T20:00:00.000Z", effectiveExpiresAt: expires,
  expiryReason: null, remainingSeconds: 600, warning: false,
});

class FakeTransport {
  status: Promise<SessionStatusSnapshot> = Promise.resolve(snapshot());
  touches = 0;
  async fetchStatus() { return this.status; }
  async touch() { this.touches += 1; return snapshot(); }
  async signOut() { return undefined; }
}

function make() {
  let now = Date.parse("2026-09-14T12:00:00.000Z");
  const transport = new FakeTransport();
  const handlers = new Set<(event: SessionSyncEvent) => void>();
  const redirects: unknown[] = [];
  const controller = new SessionLifecycleController({
    clock: { now: () => now },
    timer: { setInterval: () => 1, clearInterval: () => undefined },
    transport,
    syncBus: { publish: () => undefined, subscribe: (handler) => { handlers.add(handler); return () => handlers.delete(handler); }, close: () => undefined },
    navigation: { redirectToLogin: (input) => redirects.push(input) },
    nextUrl: "/admin/dashboard",
  });
  return { controller, transport, handlers, redirects, advance: (ms: number) => { now += ms; } };
}

describe("SessionLifecycleController", () => {
  it("establishes identity from the initial status response", async () => {
    const { controller } = make();
    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(controller.getState().currentSessionId).toBe("s1");
    expect(controller.getState().status).toBe("active");
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
});
