"use client";

import { useState, type FormEvent } from "react";
import type { Role } from "@/lib/permissions";
import { updateUserRole } from "./user-admin-actions";

type EditableUser = { id: string; displayName: string; role: Role };

export function useUserProfileEditorController({ editingUser, actorId, actorRole, closeEditor, setError, setMessage, refreshUser }: {
  editingUser: EditableUser | null;
  actorId?: string;
  actorRole?: Role;
  closeEditor: () => void;
  setError: (message: string) => void;
  setMessage: (message: string) => void;
  refreshUser: (id: string) => Promise<void>;
}) {
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleSaveUserEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser || savingEdit) return;
    setSavingEdit(true);
    setError("");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("displayName") ?? "").trim();
    const role = String(formData.get("role") ?? "") as Role;
    try {
      const result = await updateUserRole({ userId: editingUser.id, displayName, currentRole: editingUser.role, nextRole: role, actorId, actorRole: actorRole ?? editingUser.role });
      if (!result.ok) return setError(result.message ?? "Could not update user profile.");
      closeEditor();
      setMessage(`User profile updated for ${displayName}.`);
      void refreshUser(editingUser.id);
    } catch {
      setError("Network error while updating user profile.");
    } finally {
      setSavingEdit(false);
    }
  }

  return { savingEdit, handleSaveUserEdit };
}
