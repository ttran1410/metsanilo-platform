"use client";

import { Copy } from "lucide-react";
import { useAdminDialogFocus } from "../presentation";

export function UserPasswordDialog({ createdInfo, onDismiss, onCopy }: {
  createdInfo: { user: { displayName: string; email?: string | null }; tempPassword: string } | null;
  onDismiss: () => void;
  onCopy: (password: string) => void;
}) {
  const dialogRef = useAdminDialogFocus(Boolean(createdInfo), onDismiss);
  if (!createdInfo) return null;
  return <div className="admin-dialog-backdrop"><div ref={dialogRef} className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-3" role="dialog" aria-modal="true" aria-label="Temporary access password">
    <p className="eyebrow text-emerald-700">ACCOUNT CREATED / PASSWORD RESET</p>
    <h3 className="text-lg font-bold text-ink">Temporary Access Password</h3>
    <p className="text-xs muted leading-relaxed">Copy and share this temporary one-time password with <strong>{createdInfo.user.displayName}</strong> ({createdInfo.user.email}). User will be required to choose a new password on login.</p>
    <div className="p-3 bg-surface-muted border border-line rounded-xl flex items-center justify-between font-mono font-bold text-base text-primary"><span>{createdInfo.tempPassword}</span><button type="button" className="btn btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1 font-bold" onClick={() => onCopy(createdInfo.tempPassword)}><Copy className="w-3.5 h-3.5" /><span>Copy</span></button></div>
    <div className="profile-actions justify-end gap-2 mt-2"><button className="btn text-xs font-bold" type="button" onClick={onDismiss}>Done</button></div>
  </div></div>;
}
