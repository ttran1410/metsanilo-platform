"use client";

import { useState, type FormEvent } from "react";
import type { Role } from "@/lib/permissions";
import type { CreatedUser } from "./master-detail-workspace";
import { useAdminDialogFocus } from "../presentation";
import { validateEmail } from "@/lib/email";
import { inviteUser } from "./user-admin-actions";

const ROLE_PRESETS: Array<{ key: Role; label: string; description: string }> = [
  {
    key: "STAFF",
    label: "Staff (Recommended for Seasonal Workers)",
    description: "Order transitions, pickup check-off, packing queues, and basic customer context. No access to financial totals or exports.",
  },
  {
    key: "MANAGER",
    label: "Manager (Operations Lead)",
    description: "Manages daily orders, pricing, harvest capacity, sold-out locks, and staff assignments.",
  },
  {
    key: "ADMIN",
    label: "Admin (Store Owner)",
    description: "Full access to all business operations, financial ledgers, system settings, and user permissions.",
  },
  {
    key: "CONTENT_CREATOR",
    label: "Content creator (Photographer / Writer)",
    description: "Product descriptions, media gallery uploads, website copy editing, and customer reviews moderation.",
  },
];

function generateOneTimePassword() {
  const words = ["Metsa", "Marja", "Nouto", "Satakunta", "Mustikka", "Pori"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}

export function OnboardingModal({
  actorRole = "MANAGER",
  onClose,
  onCreated,
}: {
  actorRole?: Role;
  onClose: () => void;
  onCreated: (createdUser: CreatedUser, tempPassword: string) => void;
}) {
  const dialogRef = useAdminDialogFocus(true, onClose);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [password, setPassword] = useState(generateOneTimePassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canGrantAdmin = actorRole === "ADMIN";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (role === "ADMIN" && !canGrantAdmin) {
      return setError("Only Store Owner (ADMIN) accounts can grant the ADMIN role.");
    }

    const emailResult = validateEmail(email);
    if ("error" in emailResult) return setError(emailResult.error ?? "Enter a valid email address, such as name@example.com.");

    setBusy(true);

    try {
      const result = await inviteUser({ displayName: displayName.trim(), email: emailResult.email, role, password });
      setBusy(false);

      if (!result.ok || !result.data) {
        return setError(result.message ?? result.code ?? "Could not create user account.");
      }

      onCreated(result.data as CreatedUser, password);
    } catch {
      setBusy(false);
      setError("An unexpected network error occurred.");
    }
  }

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="admin-dialog card max-w-lg w-full p-6 shadow-2xl rounded-2xl bg-surface border border-line flex flex-col gap-4" role="dialog" aria-modal="true" aria-label="Create user onboarding">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <p className="eyebrow text-primary">60-SECOND STAFF ONBOARDING WIZARD</p>
            <h3 className="text-lg font-bold text-ink">Invite New Team Member</h3>
          </div>
          <button type="button" className="btn btn-secondary text-xs py-1 px-2.5" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {/* STEP 1: ACCOUNT DETAILS */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">1. Account Details</span>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="field">
                <span>Full Name</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Eero Ranta"
                  required
                />
              </label>

              <label className="field">
                <span>Email Address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => {
                    if (email && "error" in validateEmail(email)) setError("Enter a valid email address, such as name@example.com.");
                  }}
                  placeholder="eero@example.fi"
                  required
                />
              </label>
            </div>
          </div>

          {/* STEP 2: SELECT ROLE PRESET */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">2. Select Role Preset</span>
            <div className="flex flex-col gap-2">
              {ROLE_PRESETS.map((preset) => {
                const isRestrictedAdmin = preset.key === "ADMIN" && !canGrantAdmin;

                return (
                  <label
                    key={preset.key}
                    className={`p-3 rounded-xl border text-xs transition-colors flex items-start gap-3 ${
                      isRestrictedAdmin
                        ? "opacity-60 cursor-not-allowed bg-surface-muted/60 border-line"
                        : role === preset.key
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs cursor-pointer"
                        : "border-line bg-surface hover:border-muted cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name="rolePreset"
                      disabled={isRestrictedAdmin}
                      checked={role === preset.key}
                      onChange={() => !isRestrictedAdmin && setRole(preset.key)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-ink font-bold block">{preset.label}</strong>
                        {isRestrictedAdmin && (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                            🔒 Store Owner (ADMIN) Only
                          </span>
                        )}
                      </div>
                      <span className="muted block text-[11px] mt-0.5 leading-relaxed">{preset.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* STEP 3: INITIAL ONE-TIME PASSWORD */}
          <div className="flex flex-col gap-2 p-3.5 bg-surface-muted rounded-xl border border-line">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">3. One-Time Temporary Password</span>
              <button
                type="button"
                className="text-[11px] font-semibold text-primary hover:underline"
                onClick={() => setPassword(generateOneTimePassword())}
              >
                Regenerate password
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="font-mono text-sm font-bold p-2 border rounded-lg bg-surface flex-1"
              />
            </div>
            <small className="muted text-[11px]">
              User will be forced to choose a new password on their first login.
            </small>
          </div>

          <div className="profile-actions justify-end gap-2 border-t border-line pt-4">
            <button className="btn btn-secondary text-xs" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn text-xs font-semibold py-2 px-4 shadow-sm" type="submit" disabled={busy}>
              {busy ? "Creating account…" : "Create team account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
