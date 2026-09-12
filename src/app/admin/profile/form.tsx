"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Laptop, LockKeyhole, Shield, Smartphone } from "lucide-react";
import { AdminNotice } from "../presentation";
import { formatDateTime } from "@/lib/format";

type Profile = {
  displayName: string;
  email: string | null;
  username: string | null;
  role: string;
  active: boolean;
};

type SessionInfo = {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  lastActivityAt?: string;
  idleExpiresAt?: string;
  absoluteExpiresAt?: string;
  effectiveExpiresAt?: string;
  remainingSeconds?: number;
  warning?: boolean;
};

type SessionStatusResponse = {
  mechanism: "better_auth";
  currentSessionId: string | null;
  serverNow: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  effectiveExpiresAt: string;
  remainingSeconds: number;
  warning: boolean;
  sessions: SessionInfo[];
};

export function ProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [sessionStatus, setSessionStatus] = useState<SessionStatusResponse | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [revokingCurrent, setRevokingCurrent] = useState(false);

  async function loadSessions() {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (response.ok) {
        const body = await response.json();
        setSessionStatus(body.data);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSessions(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);

    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: values.get("displayName"),
        }),
      });

      const body = await response.json();
      setBusy(false);

      if (!response.ok) {
        return setError(body.message ?? "Profile update failed");
      }

      setProfile(body.data);
      setMessage("Profile saved successfully.");
    } catch {
      setBusy(false);
      setError("An unexpected network error occurred.");
    }
  }

  async function handleRevokeOthers() {
    setMessage("");
    setError("");
    setRevokingOthers(true);
    try {
      const response = await fetch("/api/auth/session", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "others" }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.message ?? "Could not revoke other sessions.");
      } else {
        setMessage("All other active browser sessions have been signed out.");
        void loadSessions();
      }
    } catch {
      setError("Failed to revoke other sessions.");
    } finally {
      setRevokingOthers(false);
    }
  }

  async function handleRevokeCurrent() {
    setMessage("");
    setError("");
    setRevokingCurrent(true);
    try {
      const response = await fetch("/api/auth/session", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "current" }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        setError(body.message ?? "Could not sign out this session.");
        return;
      }
      router.push("/admin/login?reason=signed_out&next=%2Fadmin%2Fprofile");
    } catch {
      setError("Failed to sign out this session.");
    } finally {
      setRevokingCurrent(false);
    }
  }

  const otherSessionsCount =
    sessionStatus?.mechanism === "better_auth"
      ? sessionStatus.sessions.filter((s) => s.id !== sessionStatus.currentSessionId).length
      : 0;

  return (
    <div className="profile-layout grid gap-6 md:grid-cols-2">
      {/* 1. PERSONAL DETAILS CARD */}
      <form className="card profile-card p-5 sm:p-6 border border-line flex flex-col gap-4" onSubmit={save}>
        <div className="profile-card-heading flex items-center gap-3.5 border-b border-line pb-4">
          <div className="profile-avatar-large w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-lg text-ink shrink-0">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <span className="eyebrow text-primary">PERSONAL DETAILS</span>
            <h2 className="text-xl font-bold text-ink mt-0.5">{profile.displayName}</h2>
            <span className="text-xs muted block">
              {profile.role} · {profile.active ? "Active account" : "Inactive account"}
            </span>
          </div>
        </div>

        {error && <AdminNotice tone="error" live>{error}</AdminNotice>}
        {message && <AdminNotice tone="success" live>{message}</AdminNotice>}

        <label className="field">
          <span>Display name</span>
          <input
            name="displayName"
            defaultValue={profile.displayName}
            minLength={2}
            maxLength={120}
            required
            className="w-full text-xs py-2 px-3 rounded-lg border border-line bg-surface font-medium"
          />
        </label>

        <label className="field">
          <span>Email address</span>
          <div className="relative group">
            <input
              name="email"
              type="email"
              defaultValue={profile.email ?? ""}
              readOnly
              aria-readonly="true"
              title="Email address cannot be changed here"
              className="w-full text-xs py-2 pl-3 pr-9 rounded-lg border border-line bg-surface font-medium"
            />
            <span title="Email address cannot be changed here"><LockKeyhole aria-label="Email address cannot be changed here" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" /></span>
          </div>
        </label>

        <div className="pt-2 border-t border-line mt-auto flex items-center justify-end">
          <button className="btn text-xs font-semibold py-2 px-4" type="submit" disabled={busy}>
            {busy ? "Saving changes…" : "Save profile"}
          </button>
        </div>
      </form>

      {/* 2. SECURITY & ACCESS CARD */}
      <section className="card profile-card p-5 sm:p-6 border border-line flex flex-col gap-4">
        <div className="border-b border-line pb-4">
          <span className="eyebrow text-primary">SECURITY &amp; ACCESS</span>
          <h2 className="text-xl font-bold text-ink mt-0.5">Password &amp; role</h2>
          <p className="text-xs muted mt-1 leading-relaxed">
            Update your password from the security page. Your role and permissions are managed by an administrator.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 p-3.5 bg-surface-muted/60 rounded-xl border border-line text-xs">
          <div>
            <dt className="eyebrow text-[10px] text-slate-500 font-bold">USERNAME</dt>
            <dd className="font-mono text-ink font-semibold mt-1">{profile.username ?? "—"}</dd>
          </div>
          <div>
            <dt className="eyebrow text-[10px] text-slate-500 font-bold">ASSIGNED ROLE</dt>
            <dd className="font-semibold text-ink mt-1 inline-flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-primary" />
              {profile.role}
            </dd>
          </div>
        </dl>

        <div className="pt-2 border-t border-line mt-auto flex items-center justify-between">
          <Link
            className="btn btn-secondary text-xs font-semibold py-2 px-4 inline-flex items-center gap-1.5"
            href="/admin/change-password"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-600" />
            <span>Change password</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* 3. ACTIVE SESSIONS & DEVICES CARD */}
      <section className="card profile-card p-5 sm:p-6 border border-line flex flex-col gap-4 md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <span className="eyebrow text-primary">SESSION MANAGEMENT</span>
            <h2 className="text-xl font-bold text-ink mt-0.5">Active sessions &amp; devices</h2>
            <p className="text-xs muted mt-1">
              Sessions automatically expire after 60 minutes of inactivity or 8 hours maximum lifetime.
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {sessionStatus?.mechanism === "better_auth" && otherSessionsCount > 0 && (
              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3 text-danger font-semibold"
                disabled={revokingOthers || revokingCurrent}
                onClick={() => void handleRevokeOthers()}
              >
                {revokingOthers ? "Revoking…" : `Revoke ${otherSessionsCount} other ${otherSessionsCount === 1 ? "session" : "sessions"}`}
              </button>
            )}
            {Boolean(sessionStatus?.currentSessionId) && (
              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3 text-danger font-semibold"
                disabled={revokingOthers || revokingCurrent}
                onClick={() => void handleRevokeCurrent()}
              >
                {revokingCurrent ? "Signing out…" : "Sign out this session"}
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessionStatus?.sessions.map((s) => {
            const isCurrent = s.id === sessionStatus.currentSessionId;
            return (
              <div
                key={s.id}
                className={`p-4 rounded-xl border flex flex-col gap-2.5 text-xs ${
                  isCurrent ? "bg-primary/5 border-primary/40" : "bg-surface-muted/60 border-line"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-ink">
                    {s.userAgent?.includes("iOS") || s.userAgent?.includes("Android") ? (
                      <Smartphone className="w-4 h-4 text-slate-600" aria-hidden="true" />
                    ) : (
                      <Laptop className="w-4 h-4 text-slate-600" aria-hidden="true" />
                    )}
                    <span className="truncate">{s.userAgent || "Browser session"}</span>
                  </div>
                  {isCurrent && (
                    <span className="status-pill ops-status-success text-[10px] py-0.5 px-2 font-bold">
                      Current session
                    </span>
                  )}
                </div>

                <div className="text-[11px] font-mono text-ink-muted flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>IP address</span>
                    <span className="font-semibold text-ink">{s.ipAddress || "Masked IP"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last active</span>
                    <span>{formatDateTime(s.lastActivityAt ?? s.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Idle expiry</span>
                    <span>{s.idleExpiresAt ? s.idleExpiresAt.slice(11, 19) : "—"}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {(!sessionStatus || sessionStatus.sessions.length === 0) && (
            <p className="text-xs muted italic p-3">No active sessions loaded.</p>
          )}
        </div>
      </section>
    </div>
  );
}
