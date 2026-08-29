"use client";

import { AdminConfirmDialog } from "../../presentation";

export function ManagerBulkActionDialog({ open, selectedCount, action, onCancel, onConfirm }: {
  open: boolean;
  selectedCount: number;
  action: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AdminConfirmDialog
      open={open}
      title="Apply order status change?"
      description={`Apply ${action ?? "this status"} to ${selectedCount} selected order${selectedCount === 1 ? "" : "s"}? Orders with an invalid status will be skipped.`}
      confirmLabel="Apply status"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
