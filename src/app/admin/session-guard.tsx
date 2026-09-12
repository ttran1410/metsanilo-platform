"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LockKeyhole, AlertTriangle } from "lucide-react";
import { isSessionSyncEvent, type SessionSyncEvent } from "@/lib/session-sync";

const BROADCAST_CHANNEL_NAME = "metsanilo_auth_channel";
const STORAGE_SYNC_KEY = "metsanilo_auth_sync";
const WARNING_THRESHOLD_SECONDS = 300; // 5 minutes
const TOUCH_THROTTLE_MS = 60 * 1000; // 60 seconds

function sanitizeNextUrl(pathname: string | null): string {
  if (!pathname || !pathname.startsWith("/") || pathname.startsWith("//") || pathname.startsWith("/admin/login")) {
    return "/admin/dashboard";
  }
  return pathname;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function SessionGuard() {
  const router = useRouter();
  const pathname = usePathname();

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [effectiveExpiresAt, setEffectiveExpiresAt] = useState<string | null>(null);
  const [mechanism, setMechanism] = useState<"better_auth" | null>(null);
  const [expiryReason, setExpiryReason] = useState<"idle_timeout" | "absolute_timeout" | null>(null);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const clockOffsetRef = useRef<number>(0);
  const lastTouchTimeRef = useRef<number>(0);
  const currentSessionIdRef = useRef<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastAnnouncedMinuteRef = useRef<number | null>(null);

  const titleId = useId();
  const descId = useId();

  const broadcastEvent = useCallback((event: SessionSyncEvent) => {
    try {
      channelRef.current?.postMessage(event);
    } catch {
      // BroadcastChannel unavailable
    }
    try {
      localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify({ ...event, _rnd: Math.random() }));
    } catch {
      // LocalStorage unavailable
    }
  }, []);

  const handleLogout = useCallback(
    (reason: "idle_timeout" | "absolute_timeout" | "revoked" | "signed_out") => {
      broadcastEvent({ type: "session-revoked", sessionId: currentSessionIdRef.current, reason, sentAt: new Date().toISOString() });
      const nextParam = encodeURIComponent(sanitizeNextUrl(pathname));
      router.push(`/admin/login?reason=${reason}&next=${nextParam}`);
    },
    [broadcastEvent, pathname, router]
  );

  const fetchSessionStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        headers: { "x-admin-request-scope": "session-status" },
      });

      if (response.status === 401 || response.status === 403) {
        handleLogout("revoked");
        return;
      }

      if (!response.ok) return;

      const body = await response.json();
      currentSessionIdRef.current = body.data?.currentSessionId ?? null;
      setMechanism(body.data?.mechanism ?? null);
      setExpiryReason(body.data?.expiryReason ?? null);
      if (body.data?.serverNow && body.data?.effectiveExpiresAt) {
        const serverNowMs = Date.parse(body.data.serverNow);
        if (Number.isFinite(serverNowMs)) {
          clockOffsetRef.current = serverNowMs - Date.now();
        }
        setEffectiveExpiresAt(body.data.effectiveExpiresAt);
        setExpiryReason(body.data.expiryReason ?? null);
        const expiresMs = Date.parse(body.data.effectiveExpiresAt);
        const currentServerTime = Date.now() + clockOffsetRef.current;
        const remaining = Math.max(0, Math.floor((expiresMs - currentServerTime) / 1000));
        setRemainingSeconds(remaining);
        if (remaining <= 0) {
          handleLogout(body.data.expiryReason ?? "idle_timeout");
        }
      }
    } catch {
      // Network or fetch error
    }
  }, [handleLogout]);

  const touchSession = useCallback(async () => {
    if (document.hidden) return;
    const now = Date.now();
    if (now - lastTouchTimeRef.current < TOUCH_THROTTLE_MS) {
      return;
    }
    lastTouchTimeRef.current = now;

    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        handleLogout("revoked");
        return;
      }

      if (!response.ok) return;

      const body = await response.json();
      if (body.data?.serverNow && body.data?.effectiveExpiresAt) {
        const serverNowMs = Date.parse(body.data.serverNow);
        if (Number.isFinite(serverNowMs)) {
          clockOffsetRef.current = serverNowMs - Date.now();
        }
        setEffectiveExpiresAt(body.data.effectiveExpiresAt);
        setExpiryReason(body.data.expiryReason ?? null);
        const expiresMs = Date.parse(body.data.effectiveExpiresAt);
        const currentServerTime = Date.now() + clockOffsetRef.current;
        const remaining = Math.max(0, Math.floor((expiresMs - currentServerTime) / 1000));
        setRemainingSeconds(remaining);
        setIsWarningOpen((body.data.remainingSeconds ?? 0) <= WARNING_THRESHOLD_SECONDS);

        broadcastEvent({
          type: "session-touched",
          sessionId: currentSessionIdRef.current,
          effectiveExpiresAt: body.data.effectiveExpiresAt,
          sentAt: new Date().toISOString(),
        });
      }
    } catch {
      // Network failure
    }
  }, [broadcastEvent, handleLogout]);

  const extendSessionExplicitly = async () => {
    setIsExtending(true);
    try {
      await touchSession();
    } finally {
      setIsExtending(false);
    }
  };

  const handleManualSignOut = async () => {
    try {
      await fetch("/api/auth/session", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "current" }),
      });
    } catch {
      // ignore
    }
    handleLogout("signed_out");
  };

  // 1. Initial status fetch & Cross-Tab BroadcastChannel setup
  useEffect(() => {
    const initialFetch = window.setTimeout(() => void fetchSessionStatus(), 0);

    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = (messageEvent: MessageEvent<SessionSyncEvent>) => {
        const event = messageEvent.data;
        if (!isSessionSyncEvent(event)) return;
        if (event.sessionId !== currentSessionIdRef.current) return;

        if (event.type === "session-touched") {
          setEffectiveExpiresAt(event.effectiveExpiresAt);
          const expiresMs = Date.parse(event.effectiveExpiresAt);
          const currentServerTime = Date.now() + clockOffsetRef.current;
          const remaining = Math.max(0, Math.floor((expiresMs - currentServerTime) / 1000));
          setRemainingSeconds(remaining);
          if (remaining > WARNING_THRESHOLD_SECONDS) {
            setIsWarningOpen(false);
          }
        } else if (event.type === "session-revoked") {
          const nextParam = encodeURIComponent(sanitizeNextUrl(pathname));
          router.push(`/admin/login?reason=${event.reason}&next=${nextParam}`);
        }
      };
    } catch {
      // BroadcastChannel unsupported
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_SYNC_KEY || !event.newValue) return;
      try {
        const syncData: unknown = JSON.parse(event.newValue);
        if (!isSessionSyncEvent(syncData)) return;
        if (syncData.sessionId !== currentSessionIdRef.current) return;
        if (syncData.type === "session-touched") {
          setEffectiveExpiresAt(syncData.effectiveExpiresAt);
          const expiresMs = Date.parse(syncData.effectiveExpiresAt);
          const currentServerTime = Date.now() + clockOffsetRef.current;
          const remaining = Math.max(0, Math.floor((expiresMs - currentServerTime) / 1000));
          setRemainingSeconds(remaining);
          if (remaining > WARNING_THRESHOLD_SECONDS) {
            setIsWarningOpen(false);
          }
        } else if (syncData.type === "session-revoked") {
          const nextParam = encodeURIComponent(sanitizeNextUrl(pathname));
          router.push(`/admin/login?reason=${syncData.reason}&next=${nextParam}`);
        }
      } catch {
        // storage parsing error
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.clearTimeout(initialFetch);
      channelRef.current?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchSessionStatus, pathname, router]);

  // 2. Window revalidation events (focus, visibility, online)
  useEffect(() => {
    const onFocusOrVisible = () => {
      if (!document.hidden) {
        void fetchSessionStatus();
      }
    };

    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);
    window.addEventListener("online", onFocusOrVisible);

    return () => {
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
      window.removeEventListener("online", onFocusOrVisible);
    };
  }, [fetchSessionStatus]);

  // 3. Deliberate activity tracking on qualifying user events
  useEffect(() => {
    const onQualifyingActivity = () => {
      if (!document.hidden) {
        void touchSession();
      }
    };

    const qualifyingEvents = ["keydown", "mousedown", "touchstart", "submit"];
    for (const evt of qualifyingEvents) {
      window.addEventListener(evt, onQualifyingActivity, { passive: true });
    }

    return () => {
      for (const evt of qualifyingEvents) {
        window.removeEventListener(evt, onQualifyingActivity);
      }
    };
  }, [touchSession]);

  // 4. Timer interval for 1-second countdown and warning state management
  useEffect(() => {
    if (!effectiveExpiresAt) return;

    const interval = setInterval(() => {
      const expiresMs = Date.parse(effectiveExpiresAt);
      const currentServerTime = Date.now() + clockOffsetRef.current;
      const remaining = Math.max(0, Math.floor((expiresMs - currentServerTime) / 1000));

      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
          handleLogout(expiryReason ?? "idle_timeout");
      } else if (remaining <= WARNING_THRESHOLD_SECONDS) {
        setIsWarningOpen(true);

        // Screen reader announcement logic
        const currentMinute = Math.ceil(remaining / 60);
        if (remaining > 60 && currentMinute !== lastAnnouncedMinuteRef.current) {
          lastAnnouncedMinuteRef.current = currentMinute;
          setLiveAnnouncement(`Your session will expire in ${currentMinute} minutes due to inactivity.`);
        } else if (remaining <= 60 && remaining % 15 === 0) {
          setLiveAnnouncement(`Your session will expire in ${remaining} seconds.`);
        }
      } else {
        setIsWarningOpen(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [effectiveExpiresAt, expiryReason, handleLogout, mechanism]);

  // 5. Accessibility dialog focus management
  useEffect(() => {
    if (!isWarningOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => !element.hasAttribute("disabled"));

    const items = focusable();
    items[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const elements = focusable();
        if (!elements.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [isWarningOpen]);

  if (!isWarningOpen || remainingSeconds === null || remainingSeconds <= 0) {
    return (
      <div className="sr-only" aria-live="polite" role="status">
        {liveAnnouncement}
      </div>
    );
  }

  return (
    <>
      <div className="sr-only" aria-live="polite" role="status">
        {liveAnnouncement}
      </div>
      <div className="admin-dialog-backdrop" style={{ zIndex: 9999 }}>
        <section
          ref={dialogRef}
          className="admin-dialog card"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <p className="eyebrow text-danger flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-4 h-4 text-danger" aria-hidden="true" />
            Session Inactivity Warning
          </p>
          <h2 id={titleId} className="text-xl font-bold text-ink mt-1">
            Session Expiring Soon
          </h2>
          <p id={descId} className="text-sm text-ink-muted mt-2">
            Your session will expire in{" "}
            <strong className="text-danger font-mono text-base">{formatCountdown(remainingSeconds)}</strong> due to
            inactivity. Click &quot;Stay signed in&quot; to continue your work.
          </p>

          <div className="profile-actions flex justify-end gap-3 mt-6">
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => void handleManualSignOut()}
              disabled={isExtending}
            >
              Sign out
            </button>
            <button
              type="button"
              className="btn btn-primary text-sm flex items-center gap-1.5"
              onClick={() => void extendSessionExplicitly()}
              disabled={isExtending}
            >
              <LockKeyhole className="w-4 h-4" aria-hidden="true" />
              {isExtending ? "Extending…" : "Stay signed in"}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
