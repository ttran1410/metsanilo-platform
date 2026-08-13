"use client";

import { useEffect, useState, type FormEvent } from "react";

type User = { id: string; username: string; displayName: string; role: "ADMIN" | "MANAGER" | "STAFF" | "CONTENT_CREATOR"; permissions: string[] };
const permissions = ["orders.read", "orders.update", "orders.transition", "orders.payment.write", "catalog.product.write", "catalog.package.write", "availability.write", "availability.sold_out", "delivery.override", "cms.edit", "cms.publish", "media.write", "invoices.issue", "invoices.download", "picking.write", "pickers.manage"];

export function UserModule() {
  const [users, setUsers] = useState<User[]>([]); const [message, setMessage] = useState("");
  async function load() { const response = await fetch("/api/manager/users"); const body = await response.json(); if (response.ok) setUsers(body.data); else setMessage(body.code ?? "Permission denied"); }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    const response = await fetch("/api/manager/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: values.get("username"), displayName: values.get("displayName"), role: values.get("role") }) });
    const body = await response.json(); if (!response.ok) return setMessage(body.code ?? body.message ?? "Request failed");
    event.currentTarget.reset(); setMessage("User created."); await load();
  }
  async function grant(user: User, permission: string, granted: boolean) {
    const response = await fetch(`/api/manager/users/${user.id}/permissions`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ permission, granted }) });
    const body = await response.json(); if (!response.ok) return setMessage(body.code ?? body.message ?? "Request failed");
    setUsers((rows) => rows.map((row) => row.id === user.id ? { ...row, permissions: granted ? [...new Set([...row.permissions, permission])] : row.permissions.filter((item) => item !== permission) } : row));
  }
  return <section className="shell pb-10"><h2 className="text-2xl font-bold">Users &amp; permissions</h2>{message && <p className="card mt-3" role="status">{message}</p>}
    <form className="card mt-3 grid gap-3 md:grid-cols-4" onSubmit={create}><label className="field"><span>Username</span><input name="username" required minLength={2} /></label><label className="field"><span>Display name</span><input name="displayName" required minLength={2} /></label><label className="field"><span>Role</span><select name="role" defaultValue="STAFF"><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="STAFF">Staff</option><option value="CONTENT_CREATOR">Content Creator</option></select></label><button className="btn" type="submit">Create user</button></form>
    <div className="mt-3 grid gap-3">{users.map((user) => <article className="card" key={user.id}><h3 className="font-bold">{user.displayName} <span className="pill">{user.role}</span></h3><p className="text-sm">{user.username}</p>{(user.role === "STAFF" || user.role === "CONTENT_CREATOR") && <div className="mt-2 grid gap-2 md:grid-cols-3">{permissions.map((permission) => <label className="flex items-center gap-2 text-sm" key={permission}><input type="checkbox" checked={user.permissions.includes(permission)} onChange={(event) => void grant(user, permission, event.target.checked)} />{permission}</label>)}</div>}</article>)}</div>
  </section>;
}
