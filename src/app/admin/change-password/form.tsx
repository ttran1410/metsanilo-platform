"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

export function ForcedPasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Real-time password criteria validation
  const criteria = useMemo(() => {
    return {
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /\d/.test(newPassword),
      special: /[^A-Za-z\d]/.test(newPassword),
    };
  }, [newPassword]);

  const allCriteriaMet = useMemo(() => {
    return (
      criteria.length &&
      criteria.uppercase &&
      criteria.lowercase &&
      criteria.number &&
      criteria.special
    );
  }, [criteria]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!currentPassword) {
      return setError("Current password is required.");
    }

    if (!allCriteriaMet) {
      return setError(
        "New password does not meet security rules. Please make sure it includes 8+ characters, uppercase, lowercase, number, and special character."
      );
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
        setError(body.message ?? body.code ?? "Password change failed.");
      }
    } catch {
      setBusy(false);
      setError("An unexpected network error occurred.");
    }
  }

  return (
    <form className="admin-login-form flex flex-col gap-4" onSubmit={submit} noValidate>
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

      {/* REAL-TIME PASSWORD REQUIREMENTS CHECKLIST */}
      <div className="p-3 bg-surface-muted/60 border border-line rounded-xl flex flex-col gap-1.5 text-xs">
        <span className="font-bold text-ink uppercase tracking-wider text-[11px] muted">
          🔒 Password Requirements
        </span>
        <ul className="flex flex-col gap-1 text-[11px]">
          <li className={`flex items-center gap-1.5 font-medium ${criteria.length ? "text-emerald-700 font-bold" : "muted"}`}>
            <span>{criteria.length ? "✓" : "•"}</span> At least 8 characters
          </li>
          <li className={`flex items-center gap-1.5 font-medium ${criteria.uppercase ? "text-emerald-700 font-bold" : "muted"}`}>
            <span>{criteria.uppercase ? "✓" : "•"}</span> At least 1 uppercase letter (A-Z)
          </li>
          <li className={`flex items-center gap-1.5 font-medium ${criteria.lowercase ? "text-emerald-700 font-bold" : "muted"}`}>
            <span>{criteria.lowercase ? "✓" : "•"}</span> At least 1 lowercase letter (a-z)
          </li>
          <li className={`flex items-center gap-1.5 font-medium ${criteria.number ? "text-emerald-700 font-bold" : "muted"}`}>
            <span>{criteria.number ? "✓" : "•"}</span> At least 1 number (0-9)
          </li>
          <li className={`flex items-center gap-1.5 font-medium ${criteria.special ? "text-emerald-700 font-bold" : "muted"}`}>
            <span>{criteria.special ? "✓" : "•"}</span> At least 1 special character (!@#$%^&amp;*...)
          </li>
        </ul>
      </div>

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
        <p id="password-error" className="admin-login-error text-xs font-bold text-danger bg-rose-50 p-3 rounded-xl border border-rose-200" role="alert" tabIndex={-1}>
          ⚠️ {error}
        </p>
      )}

      <button className="admin-login-submit" type="submit" disabled={busy}>
        {busy ? "Saving password…" : "Save password"}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
