"use client";

import type { FormEvent } from "react";
import { LockKeyhole, Pencil } from "lucide-react";
import type { Role } from "@/lib/permissions";

type EditableUser = { id: string; displayName: string; email: string | null; role: Role };

export function UserProfileEditDialog({ user, actorId, actorRole, saving, onCancel, onSubmit }: { user: EditableUser | null; actorId?: string; actorRole: Role; saving: boolean; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  if (!user) return null;
  const roleLocked = (actorId !== undefined && user.id === actorId && (actorRole === "ADMIN" || actorRole === "MANAGER")) || (actorRole !== "ADMIN" && user.role === "ADMIN");
  return <div className="admin-dialog-backdrop"><div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-4">
    <div className="flex items-center justify-between border-b border-line pb-2"><h3 className="text-base font-bold text-ink flex items-center gap-2"><Pencil aria-hidden="true" /> Edit profile and role</h3><button type="button" className="admin-dialog-close" aria-label="Close edit profile" onClick={onCancel}>×</button></div>
    <form className="space-y-4 text-xs" onSubmit={onSubmit}>
      <label className="field"><span>Display Name</span><input name="displayName" defaultValue={user.displayName} required minLength={2} maxLength={120} /></label>
      <label className="field"><span>Email Address</span><div className="relative group"><input name="email" type="email" defaultValue={user.email ?? ""} readOnly aria-readonly="true" title="Email address cannot be changed here" className="w-full pr-9" /><span title="Email address cannot be changed here"><LockKeyhole aria-label="Email address cannot be changed here" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" /></span></div></label>
      <label className="field"><span>Assigned Role</span><div className="relative"><select name="role" defaultValue={user.role} disabled={roleLocked} className={roleLocked ? "w-full pr-9" : "w-full"}><option value="ADMIN" disabled={actorRole !== "ADMIN"}>{actorRole !== "ADMIN" ? "ADMIN (Requires Store Owner)" : "ADMIN"}</option><option value="MANAGER">MANAGER</option><option value="STAFF">STAFF</option><option value="CONTENT_CREATOR">CONTENT_CREATOR</option></select>{roleLocked && <span title="Your role cannot be changed here"><LockKeyhole aria-label="Your role cannot be changed here" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" /></span>}</div></label>
      <div className="flex justify-end gap-2 pt-2 border-t border-line"><button className="btn btn-secondary text-xs" type="button" disabled={saving} onClick={onCancel}>Cancel</button><button className="btn text-xs font-bold min-w-[120px]" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div>
    </form>
  </div></div>;
}
