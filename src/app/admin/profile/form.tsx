"use client";

import { useState, type FormEvent } from "react";

type Profile = { displayName: string; email: string | null; username: string | null; role: string; active: boolean };

export function ProfileForm({ initial }: { initial: Profile }) {
  const [profile, setProfile] = useState(initial);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setError("");
    const values = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: values.get("displayName"), email: values.get("email") }) });
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Profile update failed");
    setProfile(body.data); setMessage("Profile updated.");
  }
  return <div className="profile-layout">
    <form className="card profile-card" onSubmit={save}><div className="profile-card-heading"><div className="profile-avatar-large">{profile.displayName.slice(0, 1).toUpperCase()}</div><div><p className="eyebrow">Personal details</p><h2>{profile.displayName}</h2><p>{profile.role} · {profile.active ? "Active account" : "Inactive account"}</p></div></div><label className="field"><span>Display name</span><input name="displayName" defaultValue={profile.displayName} minLength={2} maxLength={120} required /></label><label className="field"><span>Email</span><input name="email" type="email" defaultValue={profile.email ?? ""} required /></label>{error && <p className="error" role="alert">{error}</p>}{message && <p className="profile-success" role="status">{message}</p>}<button className="btn" type="submit">Save profile</button></form>
    <section className="card profile-card"><p className="eyebrow">Security</p><h2>Password &amp; access</h2><p className="profile-muted">Update your password from the security page. Your role and permissions are managed by an administrator.</p><a className="btn btn-secondary" href="/admin/change-password">Change password <span aria-hidden="true">→</span></a><dl className="profile-facts"><div><dt>Username</dt><dd>{profile.username ?? "—"}</dd></div><div><dt>Role</dt><dd>{profile.role}</dd></div></dl></section>
  </div>;
}
