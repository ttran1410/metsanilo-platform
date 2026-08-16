"use client";

import { useState, type FormEvent } from "react";
import { useAdminI18n } from "../i18n-context";

export function CustomerModal({
  editingCustomer,
  onClose,
  onSaved,
}: {
  editingCustomer?: { id: string; name: string; mobile?: string | null; email?: string | null; facebookProfile?: string | null; notes?: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useAdminI18n();
  const isEditing = Boolean(editingCustomer);
  const [name, setName] = useState(editingCustomer?.name ?? "");
  const [mobile, setMobile] = useState(editingCustomer?.mobile ?? "");
  const [email, setEmail] = useState(editingCustomer?.email ?? "");
  const [facebookProfile, setFacebookProfile] = useState(editingCustomer?.facebookProfile ?? "");
  const [notes, setNotes] = useState(editingCustomer?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!mobile.trim() && !facebookProfile.trim() && !email.trim()) {
      return setError("Please provide at least one contact method: Mobile Phone, Facebook, or Email.");
    }

    setBusy(true);

    try {
      const url = editingCustomer ? `/api/admin/customers/${editingCustomer.id}` : "/api/admin/customers";
      const method = editingCustomer ? "PATCH" : "POST";
      const payload = editingCustomer
        ? { action: "update", name: name.trim(), mobile: mobile.trim(), email: email.trim(), facebookProfile: facebookProfile.trim(), notes: notes.trim() }
        : { name: name.trim(), mobile: mobile.trim(), email: email.trim(), facebookProfile: facebookProfile.trim(), notes: notes.trim() };

      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      setBusy(false);

      if (!response.ok) {
        return setError(body.message ?? "Could not save customer profile.");
      }

      onSaved();
      onClose();
    } catch {
      setBusy(false);
      setError("An unexpected network error occurred.");
    }
  }

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-dialog card max-w-md w-full p-6 shadow-2xl rounded-2xl bg-surface border border-line flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <p className="eyebrow">{isEditing ? "EDIT CUSTOMER" : "NEW CUSTOMER PROFILE"}</p>
            <h3 className="text-lg font-bold text-ink">{isEditing ? t("action.edit", "Edit Contact Info") : t("crm.createCustomer", "Create Customer")}</h3>
          </div>
          <button type="button" className="btn btn-secondary text-xs py-1 px-2.5" onClick={onClose}>
            ✕ {t("action.close", "Close")}
          </button>
        </div>

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="field">
            <span>{t("crm.customerName", "Customer Name")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maija Meikäläinen"
              required
            />
          </label>

          <label className="field">
            <span>{t("crm.mobilePhone", "Mobile Phone")}</span>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="040 123 4567 or +358401234567"
            />
          </label>

          <label className="field">
            <span>{t("crm.emailAddress", "Email Address")}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maija@example.fi"
            />
          </label>

          <label className="field">
            <span>{t("crm.facebookProfile", "Facebook")}</span>
            <input
              value={facebookProfile}
              onChange={(e) => setFacebookProfile(e.target.value)}
              placeholder="e.g. facebook.com/name or Facebook Name"
            />
          </label>

          <label className="field">
            <span>{t("crm.notes", "Staff Notes & Special Handling")}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Prefers berries for freezing (firm/dry). Call daughter if no answer…"
            />
          </label>

          <div className="profile-actions justify-end gap-2 border-t border-line pt-4">
            <button className="btn btn-secondary text-xs" type="button" onClick={onClose}>
              {t("action.cancel", "Cancel")}
            </button>
            <button className="btn text-xs font-bold py-2 px-4 shadow-md" type="submit" disabled={busy}>
              {busy ? "Saving…" : isEditing ? t("action.save", "Save Changes") : t("crm.createCustomer", "Create Customer")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
