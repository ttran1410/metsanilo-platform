"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const values = new FormData(event.currentTarget); const response = await fetch("/api/auth/better/sign-in/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: values.get("email"), password: values.get("password"), rememberMe: true }) }); if (response.ok) router.push("/admin"); else { const body = await response.json().catch(() => ({})); setError(body.message ?? "Sign in failed"); setBusy(false); } }
  return <form className="admin-login-form" onSubmit={submit} noValidate><label className="admin-login-field"><span>Email <b aria-hidden="true">*</b></span><input name="email" type="email" autoComplete="email" required aria-describedby={error ? "admin-login-error" : undefined} /></label><label className="admin-login-field"><span>Password <b aria-hidden="true">*</b></span><input name="password" type="password" autoComplete="current-password" required aria-describedby={error ? "admin-login-error" : undefined} /></label>{error && <p id="admin-login-error" className="admin-login-error" role="alert" tabIndex={-1}>{error}</p>}<button className="admin-login-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span></button></form>;
}
