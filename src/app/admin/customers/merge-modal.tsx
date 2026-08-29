"use client";

import { useState } from "react";
import { useAdminDialogFocus } from "../presentation";
import { mergeCustomers } from "./use-customer-record-action-controller";

type CustomerConflict = {
  id: string;
  name: string;
  mobile: string | null;
  email?: string | null;
  notes?: string | null;
  createdAt?: string;
};

export function MergeModal({
  primaryCustomer,
  duplicateCustomer,
  onClose,
  onMerged,
  onMerge = mergeCustomers,
}: {
  primaryCustomer: { id: string; name: string; mobile: string | null; email?: string | null };
  duplicateCustomer: CustomerConflict;
  onClose: () => void;
  onMerged: () => void;
  onMerge?: (primaryId: string, duplicateId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const dialogRef = useAdminDialogFocus(true, onClose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleMerge() {
    setBusy(true);
    setError("");

    const result = await onMerge(primaryCustomer.id, duplicateCustomer.id);
    setBusy(false);
    if (!result.ok) return setError(result.message);

    onMerged();
  }

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="admin-dialog card max-w-xl w-full p-6 shadow-2xl rounded-2xl bg-surface border border-line flex flex-col gap-4" role="dialog" aria-modal="true" aria-label="Merge customers">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <p className="eyebrow text-amber-900">IDENTITY CONFLICT ASSISTANT</p>
            <h3 className="text-lg font-bold text-ink">Merge Duplicate Profiles</h3>
            <span className="text-xs muted">
              {primaryCustomer.mobile
                ? `Matching Phone: ${primaryCustomer.mobile}`
                : primaryCustomer.email
                ? `Matching Email: ${primaryCustomer.email}`
                : "Duplicate Profile Conflict"}
            </span>
          </div>
          <button type="button" className="btn btn-secondary text-xs py-1 px-2.5" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}

        <p className="text-xs muted leading-relaxed">
          Merging consolidates order history, total volumes, and notes into the Primary Profile without losing financial audit receipts. The Duplicate Record will be safely removed.
        </p>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-primary/40 bg-primary/5 flex flex-col gap-1.5">
            <span className="font-bold text-primary uppercase text-[11px] block">PRIMARY RECORD (Target)</span>
            <strong className="text-sm font-bold text-ink">{primaryCustomer.name}</strong>
            <span className="muted font-mono">{primaryCustomer.mobile || "No mobile phone"}</span>
            <span className="muted">{primaryCustomer.email || "No email"}</span>
          </div>

          <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/60 flex flex-col gap-1.5">
            <span className="font-bold text-amber-900 uppercase text-[11px] block">DUPLICATE RECORD (To Merge)</span>
            <strong className="text-sm font-bold text-ink">{duplicateCustomer.name}</strong>
            <span className="muted font-mono">{duplicateCustomer.mobile || "No mobile phone"}</span>
            <span className="muted">{duplicateCustomer.email || "No email"}</span>
          </div>
        </div>

        <div className="profile-actions justify-end gap-2 border-t border-line pt-4">
          <button className="btn btn-secondary text-xs" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn text-xs font-bold py-2 px-4 shadow-md"
            type="button"
            onClick={() => void handleMerge()}
            disabled={busy}
          >
            {busy ? "Merging…" : "🔗 Merge into Single Customer Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
