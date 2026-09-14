"use client";
import { useEffect, useId, useRef } from "react";
import { AlertTriangle, LockKeyhole } from "lucide-react";
import { useSessionLifecycle } from "@/lib/session-lifecycle/use-session-lifecycle";

function formatCountdown(seconds: number) { return seconds <= 0 ? "0:00" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

export function SessionGuard() {
  const { state, extendSession, signOut } = useSessionLifecycle();
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId(); const descId = useId();
  useEffect(() => {
    if (!state.isWarningOpen) return;
    const previous = document.activeElement as HTMLElement | null; const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? []).filter((item) => !item.hasAttribute("disabled"));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key !== "Tab") return; const items = focusable(); if (!items.length) return; if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); } };
    document.addEventListener("keydown", onKeyDown); return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [state.isWarningOpen]);
  const announcement = state.announcement;
  if (!state.isWarningOpen || state.remainingSeconds === null || state.remainingSeconds <= 0) return <div className="sr-only" aria-live="polite" role="status">{announcement}</div>;
  const reasonText = state.expiryReason === "absolute_timeout" ? "due to the maximum session lifetime" : "due to inactivity";
  return <><div className="sr-only" aria-live="polite" role="status">{announcement}</div><div className="admin-dialog-backdrop" style={{ zIndex: 9999 }}><section ref={dialogRef} className="admin-dialog card" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}><p className="eyebrow text-danger flex items-center gap-1.5 font-bold"><AlertTriangle className="w-4 h-4 text-danger" aria-hidden="true" />Session Inactivity Warning</p><h2 id={titleId} className="text-xl font-bold text-ink mt-1">Session Expiring Soon</h2><p id={descId} className="text-sm text-ink-muted mt-2">Your session will expire in <strong className="text-danger font-mono text-base">{formatCountdown(state.remainingSeconds)}</strong> {reasonText}. Click &quot;Stay signed in&quot; to continue your work.</p><div className="profile-actions flex justify-end gap-3 mt-6"><button type="button" className="btn btn-secondary text-sm" onClick={() => void signOut()} disabled={state.isExtending}>Sign out</button><button type="button" className="btn btn-primary text-sm flex items-center gap-1.5" onClick={() => void extendSession()} disabled={state.isExtending}><LockKeyhole className="w-4 h-4" aria-hidden="true" />{state.isExtending ? "Extending…" : "Stay signed in"}</button></div></section></div></>;
}
