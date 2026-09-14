"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SessionLifecycleController } from "./controller";
import { createBrowserClockPort, createBrowserNavigationPort, createBrowserSyncBusPort, createBrowserTimerPort, createBrowserTransportPort } from "./browser-ports";

export function useSessionLifecycle() {
  const router = useRouter();
  const pathname = usePathname();
  const [, rerender] = useState(0);
  const [controller] = useState(() => new SessionLifecycleController({
      clock: createBrowserClockPort(), timer: createBrowserTimerPort(), transport: createBrowserTransportPort(),
      syncBus: createBrowserSyncBusPort(), navigation: createBrowserNavigationPort(router, pathname ?? "/admin/dashboard"),
      nextUrl: pathname ?? "/admin/dashboard",
    }));
  useEffect(() => {
    const unsubscribe = controller.subscribe(() => rerender((value) => value + 1));
    const activity = () => { if (!document.hidden) controller.handleActivity(); };
    const refresh = () => { if (!document.hidden) void controller.refreshStatus(); };
    const events = ["keydown", "mousedown", "touchstart", "submit"];
    for (const event of events) window.addEventListener(event, activity, { passive: true });
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh); document.addEventListener("visibilitychange", refresh);
    controller.start();
    return () => { for (const event of events) window.removeEventListener(event, activity); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); unsubscribe(); controller.dispose(); };
  }, [controller]);
  return { state: controller.getState(), extendSession: () => controller.extendSession(), signOut: () => controller.signOut() };
}
