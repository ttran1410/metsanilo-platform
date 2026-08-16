"use client";

import { useMemo, useState } from "react";
import {
  defaultPermissionsForRole,
  isHighRiskPermission,
  type Permission,
  type Role,
} from "@/lib/permissions";
import { AdminEmptyState, AdminNotice, AdminStatusBadge } from "../presentation";
import { OnboardingModal } from "./onboarding-modal";

type UserRow = {
  id: string;
  email: string | null;
  displayName: string;
  role: Role;
  active?: boolean;
  mustChangePassword?: boolean;
  sessionVersion?: number;
  createdAt?: string;
  permissions: string[];
  customOverrides?: {
    granted: string[];
    revoked: string[];
  };
};

type SessionItem = {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  expiresAt: string;
};

type AuditItem = {
  id: string;
  action: string;
  actor: string;
  detailsJson: string;
  createdAt: string;
};

const PERMISSION_GROUPS: Array<{ label: string; icon: string; permissions: Permission[] }> = [
  {
    label: " Overview & Dashboard",
    icon: "📊",
    permissions: ["dashboard.read", "notifications.read"],
  },
  {
    label: " Orders & Fulfillment",
    icon: "📦",
    permissions: [
      "orders.read",
      "orders.create",
      "orders.update",
      "orders.transition",
      "orders.payment.read",
      "orders.payment.write",
      "orders.export",
    ],
  },
  {
    label: " Harvest Capacity & Availability",
    icon: "🫐",
    permissions: [
      "availability.read",
      "availability.write",
      "availability.sold_out",
      "delivery.read",
      "delivery.write",
      "delivery.override",
    ],
  },
  {
    label: " Customer Context",
    icon: "👥",
    permissions: [
      "customers.read",
      "customers.write",
      "customers.anonymize",
      "customers.consent.read",
      "customers.consent.write",
    ],
  },
  {
    label: " Product Catalog",
    icon: "🏷️",
    permissions: [
      "catalog.product.read",
      "catalog.product.write",
      "catalog.product.delete",
      "catalog.package.read",
      "catalog.package.write",
    ],
  },
  {
    label: " Customer Reviews & CMS",
    icon: "⭐",
    permissions: [
      "reviews.read",
      "reviews.create",
      "reviews.moderate",
      "reviews.feature",
      "reviews.visibility",
      "cms.read",
      "cms.edit",
      "cms.publish",
      "media.read",
      "media.write",
    ],
  },
  {
    label: " System & Administration",
    icon: "⚙️",
    permissions: [
      "shop_users.read",
      "shop_users.manage",
      "shop_users.password_reset",
      "shop_permissions.read",
      "shop_permissions.assign",
      "settings.read",
      "settings.operational",
      "settings.sources.manage",
      "settings.fulfillment.manage",
      "audit.read",
    ],
  },
];

const PERMISSION_LABELS: Record<string, string> = {
  "dashboard.read": "View operations overview",
  "notifications.read": "View notifications",
  "orders.read": "View order list & details",
  "orders.create": "Create manual orders",
  "orders.update": "Edit order details",
  "orders.transition": "Transition order status (Picking/Ready)",
  "orders.payment.read": "View payment status",
  "orders.payment.write": "Record payments and refunds",
  "orders.export": "Export order CSV / Customer data",
  "catalog.product.read": "View products",
  "catalog.product.write": "Edit product copy & dates",
  "catalog.product.delete": "Delete unreferenced products",
  "catalog.package.read": "View packages",
  "catalog.package.write": "Edit packages & prices",
  "availability.read": "View harvest capacity",
  "availability.write": "Edit capacity & dates",
  "availability.sold_out": "1-Click Sold Out Emergency Lock",
  "delivery.read": "View delivery work",
  "delivery.write": "Update delivery status",
  "delivery.override": "Override delivery fees",
  "customers.read": "View customer profiles & history",
  "customers.write": "Edit customer details & notes",
  "customers.anonymize": "Anonymize customer data (GDPR)",
  "customers.consent.read": "View marketing consent",
  "customers.consent.write": "Change marketing consent",
  "reviews.read": "View customer reviews",
  "reviews.create": "Add manual reviews",
  "reviews.moderate": "Moderate reviews",
  "reviews.feature": "Feature reviews on home",
  "reviews.visibility": "Show/hide Reviews page",
  "cms.read": "View site copy",
  "cms.edit": "Edit site copy",
  "cms.publish": "Publish site copy",
  "media.read": "View photo gallery",
  "media.write": "Upload & reorder photo gallery",
  "shop_users.read": "View team roster",
  "shop_users.manage": "Invite & manage staff accounts",
  "shop_users.password_reset": "Reset staff passwords",
  "shop_permissions.read": "View RBAC permissions matrix",
  "shop_permissions.assign": "Assign custom permission overrides",
  "settings.read": "View shop settings",
  "settings.operational": "Change operational settings",
  "settings.sources.manage": "Manage order sources",
  "settings.fulfillment.manage": "Manage fulfillment locations",
  "audit.read": "View access audit log",
};

function permissionName(key: string) {
  return PERMISSION_LABELS[key] ?? key.replaceAll(".", " ");
}

export function MasterDetailUserWorkspace({
  initialUsers,
  canManageUsers,
  canAssignPermissions,
  canResetPasswords,
}: {
  initialUsers: UserRow[];
  canManageUsers: boolean;
  canAssignPermissions: boolean;
  canResetPasswords: boolean;
}) {
  const [usersList, setUsersList] = useState(initialUsers);
  const [selectedId, setSelectedId] = useState<string>(initialUsers[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ user: any; tempPassword: string } | null>(null);

  const selectedUser = useMemo(() => {
    return usersList.find((u) => u.id === selectedId) ?? usersList[0];
  }, [usersList, selectedId]);

  // Load user sessions & audit
  async function loadUserExtras(id: string) {
    setSelectedId(id);
    try {
      const response = await fetch(`/api/admin/users/${id}`);
      const body = await response.json();
      if (response.ok && body.data) {
        setSessions(body.data.sessions ?? []);
        setAudit(body.data.audit ?? []);
      }
    } catch {
      /* ignore */
    }
  }

  async function refreshUsersList(idToSelect?: string) {
    try {
      const response = await fetch("/api/admin/users");
      const body = await response.json();
      if (response.ok && body.data) {
        setUsersList(body.data);
        const targetId = idToSelect ?? selectedId;
        if (targetId) void loadUserExtras(targetId);
      }
    } catch {
      /* ignore */
    }
  }

  // Filter Master Roster
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const text = `${u.displayName} ${u.email ?? ""} ${u.role}`.toLowerCase();
      const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [usersList, searchQuery, roleFilter]);

  // Grant / Revoke Permission Override
  async function handleGrantPermission(permission: Permission, granted: boolean) {
    if (!selectedUser) return;
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/users/${selectedUser.id}/permissions`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ permission, granted }),
    });

    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not update permission.");

    setMessage(`${granted ? "Granted" : "Revoked"}: ${permissionName(permission)}`);
    void refreshUsersList(selectedUser.id);
  }

  // Reset to Role Defaults
  async function handleResetToDefaults() {
    if (!selectedUser) return;
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reset_permissions" }),
    });

    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not reset permissions.");

    setMessage(`Permissions for ${selectedUser.displayName} reset to ${selectedUser.role} defaults.`);
    void refreshUsersList(selectedUser.id);
  }

  // Change Role
  async function handleChangeRole(newRole: Role) {
    if (!selectedUser) return;
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "role", role: newRole }),
    });

    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not update user role.");

    setMessage(`Role for ${selectedUser.displayName} updated to ${newRole}.`);
    void refreshUsersList(selectedUser.id);
  }

  // Toggle Active/Suspended
  async function handleToggleActive(active: boolean) {
    if (!selectedUser) return;
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "active", active }),
    });

    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not toggle account status.");

    setMessage(active ? `${selectedUser.displayName} account activated.` : `${selectedUser.displayName} account suspended.`);
    void refreshUsersList(selectedUser.id);
  }

  // Reset Password
  async function handleResetPassword() {
    if (!selectedUser) return;
    if (!window.confirm(`Reset password for ${selectedUser.displayName}?`)) return;
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/users/${selectedUser.id}/password`, { method: "POST" });
    const body = await response.json();

    if (!response.ok) return setError(body.message ?? "Password reset failed.");

    setCreatedInfo({
      user: selectedUser,
      tempPassword: body.data.temporaryPassword,
    });
  }

  // Revoke All Active Sessions
  async function handleRevokeSessions() {
    if (!selectedUser) return;
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "revoke_sessions" }),
    });

    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not revoke sessions.");

    setMessage(`All active sessions revoked for ${selectedUser.displayName}.`);
    void loadUserExtras(selectedUser.id);
  }

  const selectedDefaults = selectedUser ? defaultPermissionsForRole(selectedUser.role) : [];
  const editable =
    canAssignPermissions &&
    selectedUser &&
    (selectedUser.role === "STAFF" || selectedUser.role === "CONTENT_CREATOR");

  return (
    <section className="shell pb-10 flex flex-col gap-3">
      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      {/* MASTER-DETAIL SPLIT WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT MASTER SIDEBAR (4 Cols) */}
        <aside className="lg:col-span-4 card p-4 flex flex-col gap-3 max-h-[85vh] sticky top-4">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div>
              <span className="eyebrow">ADMINISTRATION</span>
              <h2 className="text-base font-bold text-ink">Team Roster ({filteredUsers.length})</h2>
            </div>

            {canManageUsers && (
              <button type="button" className="btn text-xs py-1 px-2.5" onClick={() => setShowWizard(true)}>
                ＋ Invite User
              </button>
            )}
          </div>

          {/* Search & Role Filters */}
          <div className="flex flex-col gap-2">
            <input
              placeholder="Search team member by name or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
            />

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {[
                { key: "ALL", label: "All Roles" },
                { key: "ADMIN", label: "👑 Admin" },
                { key: "MANAGER", label: "🛡️ Manager" },
                { key: "STAFF", label: "👤 Staff" },
                { key: "CONTENT_CREATOR", label: "🎨 Content" },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
                    roleFilter === chip.key
                      ? "bg-primary text-on-primary"
                      : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80"
                  }`}
                  onClick={() => setRoleFilter(chip.key as typeof roleFilter)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* User Master Items List */}
          <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1">
            {filteredUsers.map((user) => {
              const isSelected = user.id === selectedId;

              return (
                <button
                  key={user.id}
                  type="button"
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                      : "border-line bg-surface hover:border-muted"
                  }`}
                  onClick={() => void loadUserExtras(user.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-surface-muted border border-line shrink-0 flex items-center justify-center font-bold text-ink text-sm">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </div>

                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-sm font-bold text-ink truncate">{user.displayName}</strong>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                        user.active !== false ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}>
                        {user.active !== false ? "Active" : "Suspended"}
                      </span>
                    </div>

                    <span className="text-xs muted truncate">{user.email}</span>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-muted border border-line text-ink">
                        {user.role}
                      </span>
                      <span className="text-[10px] muted">
                        {user.permissions.length} permissions
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredUsers.length === 0 && (
              <AdminEmptyState title="No team members found" description="Adjust search query or role filter." />
            )}
          </div>
        </aside>

        {/* RIGHT DETAIL WORKSPACE PANE (8 Cols) */}
        <main className="lg:col-span-8 flex flex-col gap-4">
          {selectedUser ? (
            <div className="flex flex-col gap-4">
              {/* USER PROFILE HEADER CARD */}
              <div className="card p-4 md:p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-ink text-on-primary flex items-center justify-center text-2xl font-bold shadow-md shrink-0">
                      {selectedUser.displayName.slice(0, 1).toUpperCase()}
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight text-ink">{selectedUser.displayName}</h1>
                        <AdminStatusBadge
                          status={selectedUser.active !== false ? "CONFIRMED" : "CANCELLED"}
                          label={selectedUser.active !== false ? "Active" : "Suspended"}
                        />
                      </div>

                      <span className="text-xs muted font-semibold">{selectedUser.email}</span>
                    </div>
                  </div>

                  {/* Role Switcher & Action Toolbar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {canManageUsers && (
                      <label className="text-xs font-bold text-ink flex items-center gap-1.5 bg-surface-muted px-3 py-1.5 rounded-xl border border-line">
                        <span>Role:</span>
                        <select
                          value={selectedUser.role}
                          onChange={(e) => void handleChangeRole(e.target.value as Role)}
                          className="bg-surface border border-line rounded px-2 py-0.5 text-xs font-bold"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="STAFF">STAFF</option>
                          <option value="CONTENT_CREATOR">CONTENT_CREATOR</option>
                        </select>
                      </label>
                    )}

                    {canResetPasswords && (
                      <button
                        type="button"
                        className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                        onClick={() => void handleResetPassword()}
                      >
                        🔑 Reset Password
                      </button>
                    )}

                    {canManageUsers && (
                      <button
                        type="button"
                        className={`btn text-xs py-1.5 px-3 font-semibold ${
                          selectedUser.active !== false ? "btn-secondary text-danger" : "btn-primary"
                        }`}
                        onClick={() => void handleToggleActive(selectedUser.active === false)}
                      >
                        {selectedUser.active !== false ? "🚫 Suspend" : "🟢 Activate"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Session Kill Switch & Summary Line */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-surface-muted p-3 rounded-xl border border-line">
                  <div className="flex items-center gap-3">
                    <span>Role Defaults: <strong>{selectedDefaults.length}</strong></span>
                    <span>•</span>
                    <span>Effective Granted: <strong className="text-primary">{selectedUser.permissions.length}</strong></span>
                  </div>

                  {canManageUsers && (
                    <button
                      type="button"
                      className="btn btn-secondary text-xs py-1 px-2.5 text-danger font-semibold"
                      onClick={() => void handleRevokeSessions()}
                    >
                      🚪 Revoke All Active Sessions
                    </button>
                  )}
                </div>
              </div>

              {/* GROUPED PERMISSION ASSIGNMENT MATRIX */}
              <div className="card p-4 md:p-5 flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <span className="eyebrow">GRANULAR ACCESS CONTROL (RBAC)</span>
                    <h3 className="text-base font-bold text-ink">Permission Assignment Matrix</h3>
                  </div>

                  {canAssignPermissions && (
                    <button
                      type="button"
                      className="btn btn-secondary text-xs py-1.5 px-3"
                      onClick={() => void handleResetToDefaults()}
                    >
                      ↺ Reset to Role Defaults
                    </button>
                  )}
                </div>

                {/* Categories Hierarchy */}
                <div className="flex flex-col gap-5">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.label} className="flex flex-col gap-2 bg-surface-muted/30 p-3.5 rounded-xl border border-line">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-line/60 pb-2">
                        <span>{group.icon}</span> {group.label}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                        {group.permissions.map((permission) => {
                          const inherited = selectedDefaults.includes(permission);
                          const checked = selectedUser.permissions.includes(permission);
                          const isHighRisk = isHighRiskPermission(permission);

                          const isAddedOverride = checked && !inherited;
                          const isRevokedOverride = !checked && inherited;

                          return (
                            <label
                              key={permission}
                              className={`p-2.5 rounded-xl border flex items-start gap-3 transition-colors ${
                                checked
                                  ? "bg-surface border-line"
                                  : "bg-surface-muted/50 border-line/50 opacity-70"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!editable}
                                onChange={(e) => void handleGrantPermission(permission, e.target.checked)}
                                className="mt-1"
                              />

                              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <strong className="text-xs font-bold text-ink">{permissionName(permission)}</strong>
                                  {isHighRisk && (
                                    <span
                                      className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-900 border border-rose-300 shrink-0"
                                      title="High-risk operational permission"
                                    >
                                      🛡️ High Risk
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-[11px] mt-0.5">
                                  {inherited && !isRevokedOverride && (
                                    <span className="muted font-medium">✓ Inherited from role</span>
                                  )}

                                  {isAddedOverride && (
                                    <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                      ⭐ + Custom Override Added
                                    </span>
                                  )}

                                  {isRevokedOverride && (
                                    <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                      🚫 - Custom Revocation
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ACTIVE SESSIONS LIST */}
              <div className="card p-4 md:p-5 flex flex-col gap-3">
                <div className="border-b border-line pb-2">
                  <span className="eyebrow">DEVICE SESSIONS</span>
                  <h3 className="text-base font-bold text-ink">Active Device Sessions ({sessions.length})</h3>
                </div>

                <div className="flex flex-col gap-2">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3 rounded-xl border border-line bg-surface flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-ink font-semibold">{sess.userAgent || "Web Browser"}</strong>
                        <span className="muted">IP: {sess.ipAddress || "Unknown"} · Created {sess.createdAt.slice(0, 10)}</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        🟢 Active Session
                      </span>
                    </div>
                  ))}

                  {sessions.length === 0 && (
                    <p className="text-xs muted text-center py-3">No active device sessions registered.</p>
                  )}
                </div>
              </div>

              {/* ACCESS AUDIT TRAIL FEED */}
              <div className="card p-4 md:p-5 flex flex-col gap-3">
                <div className="border-b border-line pb-2">
                  <span className="eyebrow">SECURITY AUDIT LOG</span>
                  <h3 className="text-base font-bold text-ink">Access Audit Trail ({audit.length})</h3>
                </div>

                <div className="flex flex-col gap-2">
                  {audit.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-lg border border-line bg-surface-muted/40 text-xs flex items-center justify-between">
                      <div>
                        <strong className="text-ink font-bold">{item.action}</strong>
                        <span className="muted block text-[11px]">by {item.actor}</span>
                      </div>
                      <span className="muted font-mono text-[11px]">{item.createdAt.slice(0, 16).replace("T", " ")}</span>
                    </div>
                  ))}

                  {audit.length === 0 && (
                    <p className="text-xs muted text-center py-3">No security audit entries recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <AdminEmptyState title="Select a team member" description="Choose a user from the left master roster." />
          )}
        </main>
      </div>

      {/* ONBOARDING WIZARD MODAL */}
      {showWizard && (
        <OnboardingModal
          onClose={() => setShowWizard(false)}
          onCreated={(createdUser, tempPassword) => {
            setShowWizard(false);
            setCreatedInfo({ user: createdUser, tempPassword });
            void refreshUsersList(createdUser.id);
          }}
        />
      )}

      {/* TEMPORARY PASSWORD COPY MODAL */}
      {createdInfo && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-3">
            <p className="eyebrow text-emerald-700">ACCOUNT CREATED / PASSWORD RESET</p>
            <h3 className="text-lg font-bold text-ink">Temporary Access Password</h3>
            <p className="text-xs muted leading-relaxed">
              Copy and share this temporary one-time password with <strong>{createdInfo.user.displayName}</strong> ({createdInfo.user.email}). User will be required to choose a new password on login.
            </p>

            <div className="p-3 bg-surface-muted border border-line rounded-xl flex items-center justify-between font-mono font-bold text-base text-primary">
              <span>{createdInfo.tempPassword}</span>
              <button
                type="button"
                className="btn btn-secondary text-xs py-1 px-2.5"
                onClick={() => {
                  navigator.clipboard.writeText(createdInfo.tempPassword);
                  alert("Temporary password copied to clipboard!");
                }}
              >
                📋 Copy
              </button>
            </div>

            <div className="profile-actions justify-end gap-2 mt-2">
              <button
                className="btn text-xs font-bold"
                type="button"
                onClick={() => setCreatedInfo(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
