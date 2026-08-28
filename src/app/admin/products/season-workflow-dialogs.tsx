"use client";

import { AdminConfirmDialog } from "../presentation";

export function SeasonWorkflowDialogs({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => Promise<void> }) {
  return <AdminConfirmDialog open={open} title="Delete harvest season?" description="This removes the season configuration from this product. Existing order records and audit history are preserved." confirmLabel="Delete season" destructive onCancel={onCancel} onConfirm={onConfirm} />;
}
