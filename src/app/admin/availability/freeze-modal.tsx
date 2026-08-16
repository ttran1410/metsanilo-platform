"use client";

import { useState } from "react";

const REASON_PRESETS = [
  "🌧️ Heavy Rain / Sääeste",
  "👥 Pickers Unavailable / Työvoimapula",
  "🚜 Allocated to Wholesale / Tukkumyynti",
  "📦 Daily Capacity Full / Kapasiteetti täynnä",
];

export function FreezeModal({
  date,
  productName,
  initialReason,
  onClose,
  onConfirm,
}: {
  date: string;
  productName: string;
  initialReason?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState(initialReason ?? REASON_PRESETS[0]);
  const [customReason, setCustomReason] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalReason = useCustom ? customReason.trim() : reason;
    if (!finalReason || finalReason.length < 2) return;
    onConfirm(finalReason);
  }

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-dialog card max-w-md w-full p-6 shadow-2xl rounded-2xl bg-surface border border-line">
        <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
          <div>
            <p className="eyebrow text-danger">EMERGENCY FREEZE CONTROL</p>
            <h3 className="text-lg font-bold text-ink">Lock Intake for {date}?</h3>
            <span className="text-xs muted font-semibold block">{productName}</span>
          </div>
          <button type="button" className="btn btn-secondary text-xs py-1 px-2.5" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <p className="text-xs muted leading-relaxed mb-4">
          Locking stops public customer intake for this date in under 1 second. Select a reason to annotate the lock record.
        </p>

        <form className="flex flex-col gap-4" onSubmit={handleFormSubmit}>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">1-Tap Preset Reasons</span>
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
              <span>✍️ Enter Custom Reason…</span>
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

          <div className="profile-actions justify-end gap-2 border-t border-line pt-4">
            <button className="btn btn-secondary text-xs" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-danger text-xs font-bold py-2 px-4 shadow-md" type="submit">
              🔒 Confirm Emergency Freeze
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
