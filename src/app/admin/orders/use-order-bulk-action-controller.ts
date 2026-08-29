"use client";

import { useCallback } from "react";
import type { AdminOrder } from "./types/admin-order";

export function useOrderBulkActionController({ selected, pendingDelete, onSelectedClear, onDeletePendingClear, onDeletingChange, onArchivingChange, onNotice, onError, refresh }: { selected: string[]; pendingDelete: { deletable: AdminOrder[]; skippedPaid: AdminOrder[] } | null; onSelectedClear: () => void; onDeletePendingClear: () => void; onDeletingChange: (value: boolean) => void; onArchivingChange: (value: boolean) => void; onNotice: (message: string) => void; onError: (message: string) => void; refresh: () => Promise<void> }) {
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || pendingDelete.deletable.length === 0) return;
    onDeletingChange(true);
    try {
      const response = await fetch("/api/admin/orders/batch-delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: pendingDelete.deletable.map((order) => order.id) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Batch delete failed.");
      onNotice(`Permanently deleted ${body.data.deletedCount} order(s).${body.data.skippedPaidCount > 0 ? ` (${body.data.skippedPaidCount} paid order(s) were protected from deletion)` : ""}`);
      onSelectedClear();
      onDeletePendingClear();
      await refresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Batch delete failed.");
    } finally {
      onDeletingChange(false);
    }
  }, [onDeletePendingClear, onDeletingChange, onError, onNotice, onSelectedClear, pendingDelete, refresh]);

  const archive = useCallback(async (action: "archive" | "unarchive") => {
    if (selected.length === 0) return;
    onArchivingChange(true);
    try {
      const response = await fetch("/api/admin/orders/batch-archive", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: selected, action }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Batch archive operation failed.");
      onNotice(action === "archive" ? `Archived ${body.data.processedCount} order(s).${body.data.skippedActiveCount > 0 ? ` (${body.data.skippedActiveCount} active in-flight order(s) could not be archived)` : ""}` : `Restored ${body.data.processedCount} order(s) from archive.`);
      onSelectedClear();
      await refresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Batch archive operation failed.");
    } finally {
      onArchivingChange(false);
    }
  }, [onArchivingChange, onError, onNotice, onSelectedClear, refresh, selected]);

  return { confirmDelete, archive };
}
