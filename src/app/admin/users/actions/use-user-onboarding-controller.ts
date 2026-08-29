"use client";

import { inviteUser } from "./user-admin-actions";
import type { Role } from "@/lib/permissions";

export function useUserOnboardingController({ setError, setBusy, onCreated }: { setError: (message: string) => void; setBusy: (busy: boolean) => void; onCreated: (result: { data: unknown; password: string }) => void }) {
  async function submit(input: { displayName: string; email: string; role: Role; password: string }) {
    setBusy(true);
    try {
      const result = await inviteUser(input);
      if (!result.ok || !result.data) return setError(result.message ?? result.code ?? "Could not create user account.");
      onCreated({ data: result.data, password: input.password });
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setBusy(false);
    }
  }

  return { submit };
}
