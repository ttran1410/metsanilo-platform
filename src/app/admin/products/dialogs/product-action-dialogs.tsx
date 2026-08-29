"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";

export function ProductArchiveDialog({ productName, open, onCancel, onConfirm }: {
  productName: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return <div className="admin-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-3 shadow-2xl rounded-2xl">
      <p className="eyebrow text-amber-900">Confirm archive</p>
      <h3 className="text-lg font-bold text-ink">Archive {productName}?</h3>
      <p className="text-xs muted leading-relaxed">Archiving hides this product from the customer storefront and reservation portal. Historical order records and audit receipts will be preserved intact.</p>
      <div className="profile-actions justify-end gap-2 mt-2 pt-3 border-t border-line">
        <button className="btn btn-secondary text-xs" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 shadow-md" type="button" onClick={onConfirm}><Archive aria-hidden="true" /> Archive product</button>
      </div>
    </div>
  </div>;
}

export function ProductRestoreDialog({ productName, open, onCancel, onConfirm }: { productName: string; open: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return <div className="admin-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}><div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-3 shadow-2xl rounded-2xl"><p className="eyebrow text-emerald-800">Confirm restore</p><h3 className="text-lg font-bold text-ink">Un-archive {productName}?</h3><p className="text-xs muted leading-relaxed">Un-archiving restores this product to active status in your product catalog. Check availability dates to ensure storefront ordering is ready.</p><div className="profile-actions justify-end gap-2 mt-2 pt-3 border-t border-line"><button className="btn btn-secondary text-xs" type="button" onClick={onCancel}>Cancel</button><button className="btn text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-4 shadow-md" type="button" onClick={onConfirm}><ArchiveRestore aria-hidden="true" /> Restore product</button></div></div></div>;
}

export function ProductDeleteDialog({ productName, open, onCancel, onConfirm }: { productName: string; open: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return <div className="admin-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}><div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-3 shadow-2xl rounded-2xl"><p className="eyebrow text-danger">Confirm permanent delete</p><h3 className="text-lg font-bold text-ink">Delete {productName}?</h3><p className="text-xs muted leading-relaxed">Permanently delete this product from the database? This action cannot be undone. If historical orders exist, deletion will be blocked and the product will be archived instead.</p><div className="profile-actions justify-end gap-2 mt-2 pt-3 border-t border-line"><button className="btn btn-secondary text-xs" type="button" onClick={onCancel}>Cancel</button><button className="btn btn-danger text-xs font-bold py-2 px-4 shadow-md" type="button" onClick={onConfirm}><Trash2 aria-hidden="true" /> Delete permanently</button></div></div></div>;
}
