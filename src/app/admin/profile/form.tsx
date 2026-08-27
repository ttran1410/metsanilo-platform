"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, KeyRound, LockKeyhole, Shield } from "lucide-react";
import { AdminNotice } from "../presentation";

type Profile = {
  displayName: string;
  email: string | null;
  username: string | null;
  role: string;
  active: boolean;
};

export function ProfileForm({ initial }: { initial: Profile }) {
  const [profile, setProfile] = useState(initial);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    </div>
  );
}
