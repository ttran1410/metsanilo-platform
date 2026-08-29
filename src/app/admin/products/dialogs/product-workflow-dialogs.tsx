"use client";

import { ProductArchiveDialog, ProductDeleteDialog, ProductRestoreDialog } from "./product-action-dialogs";

export function ProductWorkflowDialogs({ productName, archiveOpen, restoreOpen, deleteOpen, onCancelArchive, onCancelRestore, onCancelDelete, onArchive, onRestore, onDelete }: {
  productName: string;
  archiveOpen: boolean;
  restoreOpen: boolean;
  deleteOpen: boolean;
  onCancelArchive: () => void;
  onCancelRestore: () => void;
  onCancelDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return <>
    <ProductArchiveDialog productName={productName} open={archiveOpen} onCancel={onCancelArchive} onConfirm={onArchive} />
    <ProductRestoreDialog productName={productName} open={restoreOpen} onCancel={onCancelRestore} onConfirm={onRestore} />
    <ProductDeleteDialog productName={productName} open={deleteOpen} onCancel={onCancelDelete} onConfirm={onDelete} />
  </>;
}
