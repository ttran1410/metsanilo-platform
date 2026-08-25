"use client";

import { useState } from "react";
import { LockKeyhole, X } from "lucide-react";
import { useAdminDialogFocus } from "../presentation";

const REASON_PRESETS = [
  "Unsafe weather / Sääeste",
  "Pickers unavailable / Työvoimapula",
  "Allocated to wholesale / Tukkumyynti",
  "Daily capacity full / Kapasiteetti täynnä",
];

export function FreezeModal({
  date,
  productName,
  mode = "freeze",
  initialReason,
  onClose,
  onConfirm,
}: {
  date: string;
  productName: string;
  mode?: "freeze" | "reopen";
  initialReason?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const dialogRef = useAdminDialogFocus(true, onClose);
  const [reason, setReason] = useState(initialReason ?? REASON_PRESETS[0]);
  const [customReason, setCustomReason] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "reopen") {
      onConfirm("");
      return;
    }
    const finalReason = useCustom ? customReason.trim() : reason;
    if (!finalReason || finalReason.length < 2) return;
    onConfirm(finalReason);
  }

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="admin-dialog card availability-freeze-dialog" role="dialog" aria-modal="true" aria-labelledby="availability-freeze-title">
        <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
          <div>
            <p className={`eyebrow ${mode === "reopen" ? "text-primary" : "text-danger"}`}>Reservation intake</p>
            <h3 id="availability-freeze-title" className="text-lg font-bold text-ink">{mode === "reopen" ? `Reopen ${date}?` : `Freeze ${date}?`}</h3>
            <span className="text-xs muted font-semibold block">{productName}</span>
          </div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close freeze dialog">
            <X aria-hidden="true" />
          </button>
        </div>

        <p className="text-xs muted leading-relaxed mb-4">
          {mode === "reopen"
            ? "Reopening allows new customer reservations again when remaining capacity can fit an active package. Existing reservations remain protected."
            : "Freezing stops new customer reservations for this product and date. Existing reservations remain protected. Select the reason recorded in the audit trail."}
        </p>

        <form className="flex flex-col gap-4" onSubmit={handleFormSubmit}>
          {mode === "reopen" ? null : (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-muted">Reason</span>
            {REASON_PRESETS.map((preset) => (
              <label
                key={preset}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs font-medium transition-colors ${
                  !useCustom && reason === preset
                    ? "border-danger bg-danger/5 text-danger font-bold ring-1 ring-danger"
                    : "border-line bg-surface hover:border-muted"
                }`}
              >
                <input
                  type="radio"
                  name="reasonPreset"
                  checked={!useCustom && reason === preset}
                  onChange={() => {
                    setReason(preset);
                    setUseCustom(false);
                  }}
                />
                <span>{preset}</span>
              </label>
            ))}

            <label
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs font-medium transition-colors ${
                useCustom ? "border-danger bg-danger/5 text-danger font-bold ring-1 ring-danger" : "border-line bg-surface"
              }`}
            >
              <input
                type="radio"
                name="reasonPreset"
                checked={useCustom}
                onChange={() => setUseCustom(true)}
              />
              <span>Enter another reason</span>
            </label>

            {useCustom && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Explain reason for intake lock…"
                required
                minLength={2}
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface mt-1"
              />
            )}
          </div>
          )}

          <div className="profile-actions justify-end gap-2 border-t border-line pt-4">
            <button className="btn btn-secondary text-xs" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className={`btn text-xs font-bold py-2 px-4 shadow-md ${mode === "reopen" ? "" : "btn-danger"}`} type="submit">
              <LockKeyhole aria-hidden="true" />{mode === "reopen" ? "Reopen date" : "Confirm freeze"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
