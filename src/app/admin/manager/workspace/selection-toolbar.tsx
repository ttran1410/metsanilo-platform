"use client";

type BulkStatus = "CONFIRMED" | "PICKING" | "READY" | "OUT_FOR_DELIVERY" | "PICKED_UP" | "DELIVERED";

export function ManagerSelectionToolbar({ filteredCount, selectedCount, allSelected, onSelectAll, onBulkTransition }: {
  filteredCount: number;
  selectedCount: number;
  allSelected: boolean;
  onSelectAll: (selected: boolean) => void;
  onBulkTransition: (status: BulkStatus) => void;
}) {
  return (
    <div className="card mt-3 flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={allSelected} onChange={(event) => onSelectAll(event.target.checked)} /> Select filtered ({filteredCount})
      </label>
      <span className="text-sm text-slate-600">{selectedCount} selected</span>
      {selectedCount > 0 && <>
        <button className="btn" type="button" onClick={() => onBulkTransition("CONFIRMED")}>Confirm</button>
        <button className="btn" type="button" onClick={() => onBulkTransition("PICKING")}>Start picking</button>
        <button className="btn" type="button" onClick={() => onBulkTransition("READY")}>Mark ready</button>
        <button className="btn" type="button" onClick={() => onBulkTransition("OUT_FOR_DELIVERY")}>Dispatch delivery</button>
        <button className="btn" type="button" onClick={() => onBulkTransition("PICKED_UP")}>Confirm pickup</button>
        <button className="btn" type="button" onClick={() => onBulkTransition("DELIVERED")}>Mark delivered</button>
      </>}
    </div>
  );
}
