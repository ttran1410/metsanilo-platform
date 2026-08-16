"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/better/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: values.get("email"), password: values.get("password"), rememberMe: true }),
    });

    if (response.ok) {
      router.push("/admin");
    } else {
      const body = await response.json().catch(() => ({}));
      setError(body.message ?? "Sign in failed");
      setBusy(false);
    }
  }

  return (
    <form className="admin-login-form" onSubmit={submit} noValidate>
      <label className="admin-login-field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required aria-describedby={error ? "admin-login-error" : undefined} />
      </label>

      <label className="admin-login-field">
        <span>Password</span>
        <div className="password-input-wrap">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-describedby={error ? "admin-login-error" : undefined}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </label>

      {error && (
        <p id="admin-login-error" className="admin-login-error" role="alert" tabIndex={-1}>
          {error}
        </p>
      )}

      <button className="admin-login-submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
