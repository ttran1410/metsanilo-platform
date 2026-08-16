"use client";

import { LogOut } from "lucide-react";

export function SignOutButton() {
  async function signOut() {
    await fetch("/api/auth/better/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    window.location.assign("/admin/login");
  }
  return (
    <button className="flex items-center gap-2 text-rose-700 hover:bg-rose-50" type="button" onClick={() => void signOut()}>
      <LogOut className="w-3.5 h-3.5" />
      <span>Sign out</span>
    </button>
  );
}
