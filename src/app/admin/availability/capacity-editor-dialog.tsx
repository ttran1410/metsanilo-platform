"use client";

import { useEffect, useState } from "react";
import type { AvailabilityWorkspace } from "@/domain/availability";
import { AdminNotice, useAdminDialogFocus } from "../presentation";

type AvailabilityRow = AvailabilityWorkspace["rows"][number];

function litres(value: number) {
  return `${(value / 1000).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} L`;
}

export function CapacityEditorDialog({ editing, error, onClose, onSave }: { editing: AvailabilityRow | null; error: string; onClose: () => void; onSave: (row: AvailabilityRow, capacityMl: number) => Promise<void> }) {
  const [capacityLitres, setCapacityLitres] = useState(0);
  const dialogRef = useAdminDialogFocus<HTMLFormElement>(editing !== null, onClose);

  useEffect(() => {
    if (editing) setCapacityLitres(editing.availability.capacityMl / 1000);
  }, [editing]);

  if (!editing) return null;
  const capacityMl = Math.round(capacityLitres * 1000);

  return <div className="admin-dialog-backdrop">
    <form ref={dialogRef} className="admin-dialog card availability-dialog" role="dialog" aria-modal="true" aria-labelledby="availability-edit-title" onSubmit={(event) => { event.preventDefault(); if (!Number.isFinite(capacityMl) || capacityMl < editing.availability.reservedMl) return; void onSave(editing, capacityMl); }}>
      <p className="eyebrow">Capacity change</p>
      <h2 id="availability-edit-title">{editing.product.nameFi} · {editing.availability.businessDate}</h2>
      <p className="muted text-xs">Review the effect before saving. This record is currently version {editing.availability.version}.</p>
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}
      <label className="field"><span>Capacity (litres)</span><input type="number" min={editing.availability.reservedMl / 1000} step="0.1" value={capacityLitres} onChange={(event) => setCapacityLitres(Number(event.target.value))} required /></label>
      <div className="availability-change-preview" aria-label="Capacity change preview">
        <div><span>Current capacity</span><strong>{litres(editing.availability.capacityMl)}</strong></div>
        <div><span>Reserved</span><strong>{litres(editing.availability.reservedMl)}</strong></div>
        <div><span>New capacity</span><strong>{litres(capacityMl)}</strong></div>
        <div><span>New remaining</span><strong>{litres(Math.max(0, capacityMl - editing.availability.reservedMl))}</strong></div>
      </div>
      <div className="admin-dialog-actions"><button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button><button className="btn" type="submit">Save capacity</button></div>
    </form>
  </div>;
}
