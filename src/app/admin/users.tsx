"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { COMING_SOON_PERMISSIONS, defaultPermissionsForRole, type Permission, type Role } from "@/lib/permissions";
import { AdminNotice } from "./presentation";

type User = { id: string; email: string | null; displayName: string; role: Role; active?: boolean; permissions: string[] };

const permissionGroups: Array<{ label: string; permissions: Permission[] }> = [
  { label: "Overview", permissions: ["dashboard.read", "notifications.read"] },
  { label: "Orders", permissions: ["orders.read", "orders.create", "orders.update", "orders.transition", "orders.payment.read", "orders.payment.write", "orders.export"] },
  { label: "Catalog", permissions: ["catalog.product.read", "catalog.product.write", "catalog.product.delete", "catalog.package.read", "catalog.package.write"] },
  { label: "Availability & delivery", permissions: ["availability.read", "availability.write", "availability.sold_out", "delivery.read", "delivery.write", "delivery.override"] },
  { label: "Customers", permissions: ["customers.read", "customers.write", "customers.anonymize", "customers.consent.read", "customers.consent.write"] },
  { label: "Reviews & content", permissions: ["reviews.read", "reviews.create", "reviews.moderate", "reviews.feature", "reviews.visibility", "cms.read", "cms.edit", "cms.publish", "media.read", "media.write"] },
  { label: "Administration", permissions: ["shop_users.read", "shop_users.manage", "shop_users.password_reset", "shop_permissions.read", "shop_permissions.assign", "settings.read", "settings.operational", "settings.sources.read", "settings.sources.manage", "settings.fulfillment.read", "settings.fulfillment.manage", "audit.read"] },
];

const permissionNames: Record<string, string> = {
  "dashboard.read": "View operations overview", "notifications.read": "View notifications", "orders.read": "View orders", "orders.create": "Create manual orders", "orders.update": "Update order details", "orders.transition": "Move orders through workflow", "orders.payment.read": "View payment status", "orders.payment.write": "Record payments and refunds", "orders.export": "Export order data", "catalog.product.read": "View products", "catalog.product.write": "Edit products", "catalog.product.delete": "Delete unreferenced products", "catalog.package.read": "View packages", "catalog.package.write": "Edit packages", "availability.read": "View harvest capacity", "availability.write": "Edit capacity and dates", "availability.sold_out": "Set manual sold-out state", "delivery.read": "View delivery work", "delivery.write": "Update delivery work", "delivery.override": "Override delivery fee", "customers.read": "View customers", "customers.write": "Edit customers", "customers.anonymize": "Anonymize customer data", "customers.consent.read": "View marketing consent", "customers.consent.write": "Change marketing consent", "reviews.read": "View reviews", "reviews.create": "Add manual reviews", "reviews.moderate": "Moderate reviews", "reviews.feature": "Feature reviews on homepage", "reviews.visibility": "Show or hide Reviews page", "cms.read": "View site content", "cms.edit": "Edit site content", "cms.publish": "Publish site content", "media.read": "View media", "media.write": "Upload and edit media", "shop_users.read": "View users", "shop_users.manage": "Manage users", "shop_users.password_reset": "Reset user passwords", "shop_permissions.read": "View permission assignments", "shop_permissions.assign": "Assign permissions", "settings.read": "View settings", "settings.operational": "Change operational settings", "settings.sources.read": "View order sources", "settings.sources.manage": "Manage order sources", "settings.fulfillment.read": "View fulfillment locations", "settings.fulfillment.manage": "Manage fulfillment locations", "audit.read": "View audit log",
};

function label(permission: string) { return permissionNames[permission] ?? permission.replaceAll(".", " "); }

export function UserModule({ canManageUsers, canAssignPermissions, canResetPasswords }: { canManageUsers: boolean; canAssignPermissions: boolean; canResetPasswords: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error">("success");
  const feedback = (text: string, nextTone: "success" | "error") => { setMessage(text); setTone(nextTone); };

  async function load() {
    const response = await fetch("/api/admin/users");
    const body = await response.json();
    if (!response.ok) return feedback(body.code ?? body.message ?? "Could not load users", "error");
    setUsers(body.data);
    setSelectedId((current) => current || body.data[0]?.id || "");
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: values.get("email"), password: values.get("password"), displayName: values.get("displayName"), role: values.get("role") }) });
    const body = await response.json();
    if (!response.ok) return feedback(body.code ?? body.message ?? "Could not create user", "error");
    form.reset(); setCreateOpen(false); feedback("User created with the selected role defaults.", "success"); await load();
  }

  async function grant(user: User, permission: string, granted: boolean) {
    const response = await fetch(`/api/admin/users/${user.id}/permissions`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ permission, granted }) });
    const body = await response.json();
    if (!response.ok) return feedback(body.code ?? body.message ?? "Could not update permission", "error");
    setUsers((rows) => rows.map((row) => row.id === user.id ? { ...row, permissions: granted ? [...new Set([...row.permissions, permission])] : row.permissions.filter((item) => item !== permission) } : row));
    feedback(`${granted ? "Granted" : "Revoked"}: ${label(permission)}`, "success");
  }

  async function resetPassword(user: User) {
    if (!window.confirm(`Reset the password for ${user.displayName}?`)) return;
    const response = await fetch(`/api/admin/users/${user.id}/password`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) return feedback(body.message ?? "Password reset failed", "error");
    window.alert(`Temporary password for ${user.email}:\n\n${body.data.temporaryPassword}\n\nCopy it now. It cannot be recovered later.`);
  }

  const visibleUsers = useMemo(() => users.filter((user) => (roleFilter === "ALL" || user.role === roleFilter) && `${user.displayName} ${user.email ?? ""}`.toLowerCase().includes(query.toLowerCase())), [users, query, roleFilter]);
  const selected = users.find((user) => user.id === selectedId) ?? visibleUsers[0];
  const selectedDefaults = selected ? defaultPermissionsForRole(selected.role) : [];

  return <div className="admin-users-workspace">
    {message && <AdminNotice tone={tone} live>{message}</AdminNotice>}
    <div className="admin-users-toolbar card"><div className="admin-filter-bar"><input aria-label="Search users" placeholder="Search name or email" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "ALL" | Role)}><option value="ALL">All roles</option><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="STAFF">Staff</option><option value="CONTENT_CREATOR">Content Creator</option></select></div>{canManageUsers && <button className="btn" type="button" onClick={() => setCreateOpen((open) => !open)}>{createOpen ? "Close" : "+ Invite user"}</button>}</div>
    {createOpen && canManageUsers && <form className="card admin-user-create-form" onSubmit={create} noValidate><div><p className="admin-section-kicker">New account</p><h2>Create user</h2><p className="admin-section-description">Role defaults are applied automatically. Additional permissions can be assigned after creation.</p></div><label className="field"><span>Display name *</span><input name="displayName" required minLength={2} /></label><label className="field"><span>Email *</span><input name="email" type="email" required /></label><label className="field"><span>Temporary password *</span><input name="password" type="password" minLength={8} required /></label><label className="field"><span>Role *</span><select name="role" defaultValue="STAFF" required><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="STAFF">Staff</option><option value="CONTENT_CREATOR">Content Creator</option></select></label><div className="admin-user-create-actions"><button className="btn btn-secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="btn" type="submit">Create user</button></div></form>}
    <div className="admin-users-layout"><section className="admin-user-list" aria-label="Users"><div className="admin-list-heading"><div><p className="admin-section-kicker">Accounts</p><h2>{visibleUsers.length} users</h2></div><span className="admin-section-description">Select a user to inspect effective access.</span></div>{visibleUsers.map((user) => <button className={`admin-user-row${selected?.id === user.id ? " selected" : ""}`} type="button" key={user.id} onClick={() => setSelectedId(user.id)}><span className="admin-avatar" aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</span><span className="admin-user-row-copy"><strong>{user.displayName}</strong><small>{user.email}</small></span><span className="pill">{user.role.replace("CONTENT_CREATOR", "CONTENT CREATOR")}</span><span className={`admin-user-status${user.active === false ? " inactive" : ""}`}>{user.active === false ? "Inactive" : "Active"}</span></button>)}{visibleUsers.length === 0 && <p className="profile-muted">No users match this filter.</p>}</section>
      {selected && <aside className="admin-user-detail card"><div className="admin-user-detail-header"><div><p className="admin-section-kicker">User access</p><h2>{selected.displayName}</h2><p>{selected.email}</p></div>{canResetPasswords && <button className="btn btn-secondary" type="button" onClick={() => void resetPassword(selected)}>Reset password</button>}</div><div className="admin-user-detail-summary"><span className="pill">{selected.role}</span><span>{selectedDefaults.length} inherited permissions</span><span>{selected.permissions.length} effective permissions</span></div><div className="permission-groups">{permissionGroups.map((group) => <fieldset key={group.label}><legend>{group.label}</legend>{group.permissions.map((permission) => { const inherited = selectedDefaults.includes(permission); const checked = selected.permissions.includes(permission); const editable = canAssignPermissions && (selected.role === "STAFF" || selected.role === "CONTENT_CREATOR"); return <label className={`permission-row${checked ? " checked" : ""}`} key={permission}><input type="checkbox" checked={checked} disabled={!editable} onChange={(event) => void grant(selected, permission, event.target.checked)} /><span><strong>{label(permission)}</strong><small>{inherited ? "Inherited from role" : checked ? "Added directly" : "Not granted"}</small></span></label>; })}</fieldset>)}<fieldset><legend>Roadmap</legend>{COMING_SOON_PERMISSIONS.map((permission) => <div className="permission-row coming-soon" key={permission}><span aria-hidden="true">○</span><span><strong>{label(permission)}</strong><small>Coming soon · not assignable yet</small></span></div>)}</fieldset></div></aside>}
    </div>
  </div>;
}
