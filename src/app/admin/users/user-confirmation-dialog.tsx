"use client";

import { AdminConfirmDialog } from "../presentation";

export function UserConfirmationDialog({ confirmation, onCancel, onConfirm }: {
  confirmation: { title: string; description: string; confirmLabel: string; destructive?: boolean } | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return <AdminConfirmDialog open={confirmation !== null} title={confirmation?.title ?? "Confirm action"} description={confirmation?.description} confirmLabel={confirmation?.confirmLabel} destructive={confirmation?.destructive} onCancel={onCancel} onConfirm={onConfirm} />;
}
