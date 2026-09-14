import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { isSessionSyncEvent, type SessionSyncEvent } from "@/lib/session-sync";
import type { ClockPort, NavigationPort, SessionStatusSnapshot, SessionSyncBusPort, SessionTransportPort, TimerPort } from "./types";

export const sanitizeNextUrl = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/admin/login") || value.includes("://")) return "/admin/dashboard";
  return value;
};

export const createBrowserClockPort = (): ClockPort => ({ now: () => Date.now() });
export const createBrowserTimerPort = (): TimerPort => ({ setInterval: (callback, ms) => window.setInterval(callback, ms), clearInterval: (handle) => window.clearInterval(handle as number) });

async function readSnapshot(response: Response): Promise<SessionStatusSnapshot> {
  const body = await response.json() as { data?: SessionStatusSnapshot; message?: string };
  if (!response.ok) throw Object.assign(new Error(body.message ?? "Session request failed"), { status: response.status });
  if (!body.data?.serverNow || !body.data.effectiveExpiresAt) throw new Error("Invalid session response");
  return body.data;
}

export const createBrowserTransportPort = (): SessionTransportPort => ({
  async fetchStatus() { return readSnapshot(await fetch("/api/auth/session", { cache: "no-store", headers: { "x-admin-request-scope": "session-status" } })); },
  async touch() { return readSnapshot(await fetch("/api/auth/session", { method: "POST", cache: "no-store", headers: { "content-type": "application/json" } })); },
  async signOut() { await fetch("/api/auth/session", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "current" }) }); },
});

export const createBrowserNavigationPort = (router: AppRouterInstance, nextUrl: string): NavigationPort => ({
  redirectToLogin: ({ reason }) => router.push(`/admin/login?reason=${reason}&next=${encodeURIComponent(sanitizeNextUrl(nextUrl))}`),
});

export const createBrowserSyncBusPort = (): SessionSyncBusPort => {
  if (typeof window === "undefined") return { publish: () => undefined, subscribe: () => () => undefined, close: () => undefined };
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("metsanilo_auth_channel");
  const handlers = new Set<(event: SessionSyncEvent) => void>();
  const seen = new Map<string, number>();
  const deliver = (value: unknown) => {
    if (!isSessionSyncEvent(value)) return;
    const event = value as SessionSyncEvent;
    const id = event.eventId ?? `${event.type}:${event.sessionId}:${event.sentAt}:${"reason" in event ? event.reason : event.effectiveExpiresAt}`;
    const now = Date.now();
    for (const [key, time] of seen) if (now - time > 300_000) seen.delete(key);
    if (seen.has(id)) return;
    seen.set(id, now);
    for (const handler of handlers) handler(event);
  };
  const onStorage = (event: StorageEvent) => { if (event.key !== "metsanilo_auth_sync" || !event.newValue) return; try { deliver(JSON.parse(event.newValue)); } catch { /* malformed storage payload */ } };
  channel?.addEventListener("message", (event) => deliver(event.data));
  window.addEventListener("storage", onStorage);
  return {
    publish(event) { channel?.postMessage(event); try { localStorage.setItem("metsanilo_auth_sync", JSON.stringify(event)); } catch { /* storage unavailable */ } },
    subscribe(handler) { handlers.add(handler); return () => handlers.delete(handler); },
    close() { handlers.clear(); channel?.close(); window.removeEventListener("storage", onStorage); },
  };
};
