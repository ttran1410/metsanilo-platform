"use client";

export function SignOutButton() {
  async function signOut() {
    await fetch("/api/auth/better/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    window.location.assign("/admin/login");
  }
  return <button type="button" onClick={() => void signOut()}>Sign out</button>;
}
