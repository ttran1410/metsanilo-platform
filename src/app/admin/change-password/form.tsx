"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ForcedPasswordForm() {
  const router = useRouter(); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: values.get("currentPassword"), newPassword: values.get("newPassword") }) }); const body = await response.json(); if (response.ok) router.push("/admin"); else setError(body.message ?? "Password change failed"); }
  return <form className="admin-login-form" onSubmit={submit} noValidate><label className="admin-login-field"><span>Current password <b aria-hidden="true">*</b></span><input name="currentPassword" type="password" autoComplete="current-password" required aria-describedby={error ? "password-error" : undefined} /></label><label className="admin-login-field"><span>New password <b aria-hidden="true">*</b></span><input name="newPassword" type="password" autoComplete="new-password" minLength={8} required aria-describedby={error ? "password-error" : undefined} /></label>{error && <p id="password-error" className="admin-login-error" role="alert" tabIndex={-1}>{error}</p>}<button className="admin-login-submit" type="submit">Save password<span aria-hidden="true">→</span></button></form>;
}
