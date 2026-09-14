"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SessionLifecycleState } from "./types";
import { SessionLifecycleController } from "./controller";
import { createBrowserClockPort, createBrowserNavigationPort, createBrowserSyncBusPort, createBrowserTimerPort, createBrowserTransportPort } from "./browser-ports";

const initialState: SessionLifecycleState = {
  status: "idle", currentSessionId: null, effectiveExpiresAt: null, remainingSeconds: null,
  clockOffsetMs: 0, lastTouchAttemptMs: null, isExtending: false, isWarningOpen: false,
  expiryReason: null, announcement: "", hasNavigated: false,
};

export function useSessionLifecycle() {
  const router = useRouter();
  const pathname = usePathname();
  const controllerRef = useRef<SessionLifecycleController | null>(null);
  const [state, setState] = useState(initialState);

  useEffect(() => {
    const nextUrl = pathname ?? "/admin/dashboard";
    const controller = new SessionLifecycleController({
      clock: createBrowserClockPort(), timer: createBrowserTimerPort(), transport: createBrowserTransportPort(),
      syncBus: createBrowserSyncBusPort(), navigation: createBrowserNavigationPort(router), nextUrl,
    });
    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(setState);
    const activity = () => { if (!document.hidden) controller.handleActivity(); };
    const refresh = () => { if (!document.hidden) void controller.refreshStatus(); };
    const events = ["keydown", "mousedown", "touchstart", "submit"];
    for (const event of events) window.addEventListener(event, activity, { passive: true });
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh); document.addEventListener("visibilitychange", refresh);
    controller.start();
    return () => {
      for (const event of events) window.removeEventListener(event, activity);
      window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh);
      unsubscribe(); controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [pathname, router]);

  return {
    state,
    extendSession: () => controllerRef.current?.extendSession() ?? Promise.resolve(),
    signOut: () => controllerRef.current?.signOut() ?? Promise.resolve(),
  };
}
