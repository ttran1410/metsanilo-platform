"use client";

import { useState, type FormEvent } from "react";
import { useAdminDialogFocus } from "../presentation";
import { saveCustomer, type CustomerSaveInput } from "./use-customer-record-action-controller";

export type CustomerModalProps = {
  editingCustomer?: {
    id: string;
    name: string;
    mobile?: string | null;
    email?: string | null;
    facebookProfile?: string | null;
    streetAddress?: string | null;
    postalCode?: string | null;
    city?: string | null;
    preferredMethod?: "PICKUP" | "DELIVERY" | null;
    preferredLanguage?: "FI" | "EN" | null;
    marketingConsent?: boolean | null;
    notes?: string | null;
  } | null;
  onClose: () => void;
  onSaved: () => void;
  onSave?: (input: CustomerSaveInput) => Promise<{ ok: true } | { ok: false; message: string }>;
};

export function CustomerModal({
  editingCustomer,
  onClose,
  onSaved,
  onSave = saveCustomer,
}: CustomerModalProps) {
  const isEditing = Boolean(editingCustomer);
  const dialogRef = useAdminDialogFocus(true, onClose);
  const [name, setName] = useState(editingCustomer?.name ?? "");
  const [mobile, setMobile] = useState(editingCustomer?.mobile ?? "");
  const [email, setEmail] = useState(editingCustomer?.email ?? "");
  const [facebookProfile, setFacebookProfile] = useState(editingCustomer?.facebookProfile ?? "");
  const [streetAddress, setStreetAddress] = useState(editingCustomer?.streetAddress ?? "");
  const [postalCode, setPostalCode] = useState(editingCustomer?.postalCode ?? "");
  const [city, setCity] = useState(editingCustomer?.city ?? "Pori");
  const [preferredMethod, setPreferredMethod] = useState<"PICKUP" | "DELIVERY">(editingCustomer?.preferredMethod ?? "PICKUP");
  const [preferredLanguage, setPreferredLanguage] = useState<"FI" | "EN">(editingCustomer?.preferredLanguage ?? "FI");
  const [marketingConsent, setMarketingConsent] = useState(editingCustomer?.marketingConsent ?? false);
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
      const payload: CustomerSaveInput = {
        ...(editingCustomer ? { id: editingCustomer.id } : {}),
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        facebookProfile: facebookProfile.trim(),
        streetAddress: streetAddress.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
        preferredMethod,
        preferredLanguage,
        marketingConsent,
        notes: notes.trim(),
      };

      const result = await onSave(payload);
      setBusy(false);
      if (!result.ok) return setError(result.message);

      onSaved();
      onClose();
    } catch {
      setBusy(false);
      setError("An unexpected network error occurred.");
    }
  }

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="admin-dialog card max-w-xl w-full p-6 shadow-2xl rounded-2xl bg-surface border border-line flex flex-col gap-4" role="dialog" aria-modal="true" aria-label={isEditing ? "Edit customer" : "Create customer"}>
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <p className="eyebrow">{isEditing ? "EDIT CUSTOMER PROFILE" : "NEW CUSTOMER PROFILE"}</p>
            <h3 className="text-lg font-bold text-ink">{isEditing ? "Edit Customer Details" : "Create New Customer"}</h3>
          </div>
          <button type="button" className="btn btn-secondary text-xs py-1 px-2.5 font-bold" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {error && (
          <div className="p-3 text-xs font-bold rounded-xl bg-rose-100 text-rose-900 border border-rose-300">
            ⚠️ {error}
          </div>
        )}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {/* SECTION 1: IDENTITY & CONTACT INFO */}
          <div className="space-y-3">
            <span className="eyebrow text-primary">1. CONTACT IDENTITY</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="field col-span-1 sm:col-span-2">
                <span>Customer Full Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maija Meikäläinen"
                  required
                />
              </label>

              <label className="field">
                <span>Mobile Phone (+358)</span>
                <input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="040 123 4567 or +358401234567"
                />
              </label>

              <label className="field">
                <span>Email Address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maija@example.fi"
                />
              </label>

              <label className="field">
                <span>Facebook Profile Link / Handle</span>
                <input
                  value={facebookProfile}
                  onChange={(e) => setFacebookProfile(e.target.value)}
                  placeholder="e.g. facebook.com/name or Facebook Name"
                />
              </label>

              <label className="field">
                <span>Preferred Language</span>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value as "FI" | "EN")}
                  className="font-bold text-xs"
                >
                  <option value="FI">🇫🇮 Finnish (Suomi)</option>
                  <option value="EN">🇬🇧 English</option>
                </select>
              </label>
            </div>
          </div>

          {/* SECTION 2: DELIVERY ADDRESS & FULFILLMENT PREFERENCES */}
          <div className="space-y-3 pt-2 border-t border-line/60">
            <span className="eyebrow text-primary">2. DELIVERY ADDRESS &amp; PREFERENCES</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="field col-span-1 sm:col-span-3">
                <span>Street Address</span>
                <input
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. Aleksanterinkatu 12 A 4"
                />
              </label>

              <label className="field">
                <span>Postal Code</span>
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="28100"
                />
              </label>

              <label className="field col-span-1 sm:col-span-2">
                <span>City</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Pori"
                />
              </label>

              <label className="field col-span-1 sm:col-span-3">
                <span>Pinned Preferred Fulfillment Method</span>
                <select
                  value={preferredMethod}
                  onChange={(e) => setPreferredMethod(e.target.value as "PICKUP" | "DELIVERY")}
                  className="font-bold text-xs"
                >
                  <option value="PICKUP">📍 Pickup (Nouto)</option>
                  <option value="DELIVERY">🚚 Home Delivery (Kotiinkuljetus)</option>
                </select>
              </label>
            </div>
          </div>

          {/* SECTION 3: CRM NOTES & MARKETING GOVERNANCE */}
          <div className="space-y-3 pt-2 border-t border-line/60">
            <span className="eyebrow text-primary">3. CRM NOTES &amp; CONSENT</span>

            <label className="field text-xs">
              <span>Staff Notes &amp; Special Handling</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Prefers berries for freezing (firm/dry). Call daughter if no answer…"
              />
            </label>

            <label className="field-checkbox text-xs">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
              />
              <span className="font-semibold">Harvest Marketing SMS / Email Opt-in Consent</span>
            </label>
          </div>

          <div className="profile-actions justify-end gap-2 border-t border-line pt-4">
            <button className="btn btn-secondary text-xs font-semibold py-2 px-4" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn text-xs font-bold py-2 px-4 shadow-md" type="submit" disabled={busy}>
              {busy ? "Saving…" : isEditing ? "Save Changes" : "Create Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
