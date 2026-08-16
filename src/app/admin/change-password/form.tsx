"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ForcedPasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!currentPassword) {
      return setError("Current password is required.");
    }

    if (newPassword.length < 8) {
      return setError("New password must be at least 8 characters long.");
    }

    if (newPassword !== confirmNewPassword) {
      return setError("New password and confirm password do not match.");
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const body = await response.json();
      setBusy(false);

      if (response.ok) {
        router.push("/admin");
      } else {
        setError(body.message ?? "Password change failed.");
      }
    } catch {
      setBusy(false);
      setError("An unexpected network error occurred.");
    }
  }

  return (
    <form className="admin-login-form" onSubmit={submit} noValidate>
      <label className="admin-login-field">
        <span>
          Current password <b aria-hidden="true">*</b>
        </span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          aria-describedby={error ? "password-error" : undefined}
        />
      </label>

      <label className="admin-login-field">
        <span>
          New password <b aria-hidden="true">*</b>
        </span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          aria-describedby={error ? "password-error" : undefined}
        />
      </label>

      <label className="admin-login-field">
        <span>
          Confirm new password <b aria-hidden="true">*</b>
        </span>
        <input
          name="confirmNewPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          required
          aria-describedby={error ? "password-error" : undefined}
        />
      </label>

      {error && (
        <p id="password-error" className="admin-login-error" role="alert" tabIndex={-1}>
          {error}
        </p>
      )}

      <button className="admin-login-submit" type="submit" disabled={busy}>
        {busy ? "Saving password…" : "Save password"}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
