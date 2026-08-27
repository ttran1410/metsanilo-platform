"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Boxes, ChevronDown, ClipboardList, Copy, Gauge, KeyRound, LockKeyhole, MapPinned, Pencil, Plus, RefreshCcw, Save, ShieldAlert, ShieldCheck, ShoppingBasket, Store, UserRoundX, UsersRound, type LucideIcon } from "lucide-react";
import {
  defaultPermissionsForRole,
  isHighRiskPermission,
  type Permission,
  type Role,
} from "@/lib/permissions";
import { AdminConfirmDialog, AdminEmptyState, AdminNotice, AdminStatusBadge, useAdminDialogFocus } from "../presentation";
import { AdminPagination, AdminSidebarInfiniteFooter } from "../ui/admin-pagination";
import { AdminRowActionMenu, IconEye, IconLock, IconPencil } from "../ui/admin-row-action-menu";
import { AdminSearchField } from "../ui/admin-search-field";
import { OnboardingModal } from "./onboarding-modal";

export type UserRow = {
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

export type CreatedUser = Pick<UserRow, "id" | "email" | "displayName" | "role">;

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

const PERMISSION_GROUPS: Array<{ label: string; icon: LucideIcon; permissions: Permission[] }> = [
  {
    label: "Overview and notifications",
    icon: Gauge,
    permissions: ["dashboard.read", "notifications.read"],
  },
  {
    label: "Orders and fulfilment",
    icon: ShoppingBasket,
    permissions: [
      "orders.read",
      "orders.create",
      "orders.update",
      "orders.transition",
      "orders.payment.read",
      "orders.payment.write",
      "orders.export",
      "orders.delete",
      "orders.archive",
    ],
  },
  {
    label: "Availability and delivery",
    icon: MapPinned,
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
    label: "Customer context",
    icon: UsersRound,
    permissions: [
      "customers.read",
      "customers.write",
      "customers.anonymize",
      "customers.retention.manage",
      "customers.consent.read",
      "customers.consent.write",
    ],
  },
  {
    label: "Product catalog",
    icon: Boxes,
    permissions: [
      "catalog.product.read",
      "catalog.product.write",
      "catalog.product.delete",
      "catalog.package.read",
      "catalog.package.write",
    ],
  },
  {
    label: "Reviews and storefront content",
    icon: Store,
    permissions: [
      "reviews.read",
      "reviews.create",
      "reviews.moderate",
      "reviews.feature",
      "reviews.visibility",
      "cms.read",
      "cms.edit",
      "cms.publish",
      "theme.manage",
      "media.read",
      "media.write",
    ],
  },
  {
    label: "System administration",
    icon: ShieldCheck,
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
  "orders.delete": "Permanently delete unpaid/test orders",
  "orders.archive": "Archive & restore completed orders",
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
  "customers.retention.manage": "Manage customer retention confirmation",
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
  "theme.manage": "Draft, publish and restore Frontstore themes",
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
  actorRole = "MANAGER",
  actorId,
  canManageUsers,
  canAssignPermissions,
  canResetPasswords,
}: {
  initialUsers: UserRow[];
  actorRole?: Role;
  actorId?: string;
  canManageUsers: boolean;
  canAssignPermissions: boolean;
  canResetPasswords: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usersList, setUsersList] = useState(initialUsers);
  const [selectedId, setSelectedId] = useState<string>(searchParams.get("user") ?? initialUsers[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>(() => {
    const role = searchParams.get("role");
    return role === "ADMIN" || role === "MANAGER" || role === "STAFF" || role === "CONTENT_CREATOR" ? role : "ALL";
  });
  const [viewMode, setViewMode] = useState<"split" | "table">("split");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingPermissions, setPendingPermissions] = useState<Partial<Record<Permission, boolean>>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ user: CreatedUser; tempPassword: string } | null>(null);
  const passwordDialogRef = useAdminDialogFocus(Boolean(createdInfo), () => setCreatedInfo(null));
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; confirmLabel: string; destructive?: boolean; onConfirm: () => Promise<void> } | null>(null);

  const metrics = useMemo(() => {
    const total = usersList.length;
    const adminManagers = usersList.filter((u) => u.role === "ADMIN" || u.role === "MANAGER").length;
    const staffPickers = usersList.filter((u) => u.role === "STAFF" || u.role === "CONTENT_CREATOR").length;
    const customOverrides = usersList.filter(
      (u) => (u.customOverrides?.granted?.length ?? 0) > 0 || (u.customOverrides?.revoked?.length ?? 0) > 0
    ).length;

    return { total, adminManagers, staffPickers, customOverrides };
  }, [usersList]);

  const selectedUser = useMemo(() => {
    return usersList.find((u) => u.id === selectedId) ?? usersList[0];
  }, [usersList, selectedId]);

  // Load user sessions & audit
  async function loadUserExtras(id: string) {
    setSelectedId(id);
    setMobileView("detail");
    setPendingPermissions({});
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedId) void loadUserExtras(selectedId);
    }, 0);
    return () => window.clearTimeout(timer);
    // Load the initially selected user's lifecycle context once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [splitLimit, setSplitLimit] = useState(20);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (searchQuery) next.set("q", searchQuery); else next.delete("q");
    if (roleFilter !== "ALL") next.set("role", roleFilter); else next.delete("role");
    if (selectedId) next.set("user", selectedId); else next.delete("user");
    if (currentPage > 1) next.set("page", String(currentPage)); else next.delete("page");
    if (next.toString() !== searchParams.toString()) router.replace(`?${next.toString()}`, { scroll: false });
  }, [currentPage, roleFilter, router, searchParams, searchQuery, selectedId]);

  useEffect(() => {
    // Return to the first page when roster filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
    setSplitLimit(20);
  }, [searchQuery, roleFilter]);

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const text = `${u.displayName} ${u.email ?? ""} ${u.role}`.toLowerCase();
      const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [usersList, searchQuery, roleFilter]);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (activeMenuId && !(event.target as HTMLElement).closest(".row-action-menu")) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activeMenuId]);

  const sidebarDisplayedUsers = useMemo(() => {
    return filteredUsers.slice(0, splitLimit);
  }, [filteredUsers, splitLimit]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  function stagePermission(permission: Permission, granted: boolean) {
    if (!selectedUser) return;
    const current = selectedUser.permissions.includes(permission);
    setPendingPermissions((changes) => {
      const next = { ...changes };
      if (granted === current) delete next[permission];
      else next[permission] = granted;
      return next;
    });
  }

  async function savePermissionChanges() {
    if (!selectedUser || savingPermissions) return;
    const changes = Object.entries(pendingPermissions) as Array<[Permission, boolean]>;
    if (!changes.length) return;
    setSavingPermissions(true);
    setError("");
    setMessage("");
    let saved = 0;
    try {
      for (const [permission, granted] of changes) {
        const response = await fetch(`/api/admin/users/${selectedUser.id}/permissions`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ permission, granted }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? `Could not update ${permissionName(permission)}.`);
        saved += 1;
      }
      setPendingPermissions({});
      setMessage(`${saved} permission ${saved === 1 ? "change" : "changes"} saved for ${selectedUser.displayName}.`);
      await refreshUsersList(selectedUser.id);
    } catch (caught) {
      setError(`${saved ? `${saved} changes were saved. ` : ""}${caught instanceof Error ? caught.message : "Could not save permission changes."}`);
      await refreshUsersList(selectedUser.id);
    } finally {
      setSavingPermissions(false);
    }
  }

  // Reset to Role Defaults
  async function handleResetToDefaults() {
    if (!selectedUser) return;
    setConfirmation({ title: "Reset custom permissions?", description: `Remove all custom permission overrides for ${selectedUser.displayName} and restore ${selectedUser.role} defaults?`, confirmLabel: "Reset permissions", destructive: true, onConfirm: async () => { setError(""); setMessage(""); const response = await fetch(`/api/admin/users/${selectedUser.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reset_permissions" }) }); const body = await response.json(); if (!response.ok) return setError(body.message ?? "Could not reset permissions."); setMessage(`Permissions for ${selectedUser.displayName} reset to ${selectedUser.role} defaults.`); void refreshUsersList(selectedUser.id); } });
  }

  // Toggle Active/Suspended
  async function handleToggleActive(active: boolean) {
    if (!selectedUser) return;
    setConfirmation({ title: `${active ? "Activate" : "Suspend"} user account?`, description: `${active ? "Activate" : "Suspend"} ${selectedUser.displayName}.${active ? "" : " Their active sessions will no longer be valid."}`, confirmLabel: active ? "Activate account" : "Suspend account", destructive: !active, onConfirm: async () => { setError(""); setMessage(""); const response = await fetch(`/api/admin/users/${selectedUser.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "active", active }) }); const body = await response.json(); if (!response.ok) return setError(body.message ?? "Could not toggle account status."); setMessage(active ? `${selectedUser.displayName} account activated.` : `${selectedUser.displayName} account suspended.`); void refreshUsersList(selectedUser.id); } });
  }

  // Reset Password
  async function handleResetPassword(target: UserRow | undefined = selectedUser) {
    if (!target) return;
    setConfirmation({ title: "Reset user password?", description: `Generate a new temporary password for ${target.displayName}? Their current password will stop working.`, confirmLabel: "Reset password", destructive: true, onConfirm: async () => { setError(""); setMessage(""); const response = await fetch(`/api/admin/users/${target.id}/password`, { method: "POST" }); const body = await response.json(); if (!response.ok) return setError(body.message ?? "Password reset failed."); setCreatedInfo({ user: target, tempPassword: body.data.temporaryPassword }); } });
  }

  // Revoke All Active Sessions
  async function handleRevokeSessions() {
    if (!selectedUser) return;
    setConfirmation({ title: "Revoke active sessions?", description: `Sign out ${selectedUser.displayName} from every active session?`, confirmLabel: "Revoke sessions", destructive: true, onConfirm: async () => { setError(""); setMessage(""); const response = await fetch(`/api/admin/users/${selectedUser.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke_sessions" }) }); const body = await response.json(); if (!response.ok) return setError(body.message ?? "Could not revoke sessions."); setMessage(`All active sessions revoked for ${selectedUser.displayName}.`); void loadUserExtras(selectedUser.id); } });
  }

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
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
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update", displayName, role }),
      });

      const body = await response.json();
      setSavingEdit(false);

      if (!response.ok) {
        setError(body.message ?? "Could not update user profile.");
        return;
      }

      setEditingUser(null);
      setMessage(`User profile updated for ${displayName}.`);
      void refreshUsersList(editingUser.id);
    } catch {
      setSavingEdit(false);
      setError("Network error while updating user profile.");
    }
  }

  const selectedDefaults = selectedUser ? defaultPermissionsForRole(selectedUser.role) : [];
  const editable =
    canAssignPermissions &&
    selectedUser &&
    (actorRole === "ADMIN" || selectedUser.role === "STAFF" || selectedUser.role === "CONTENT_CREATOR") &&
    (actorRole === "ADMIN" || selectedUser.role !== "ADMIN");
  const pendingPermissionCount = Object.keys(pendingPermissions).length;

  return (
    <section className="admin-users-workspace shell pb-10 flex flex-col gap-4">
      {message && <AdminNotice tone="success" live>{message}</AdminNotice>}
      {error && <AdminNotice tone="error" live>{error}</AdminNotice>}

      <div className="admin-user-metrics">
        <div>
          <span>Total team</span>
          <strong>{metrics.total}</strong>
          <small>Staff accounts</small>
        </div>

        <div>
          <span>Privileged roles</span>
          <strong>{metrics.adminManagers}</strong>
          <small>Admin and manager</small>
        </div>

        <div>
          <span>Operational roles</span>
          <strong>{metrics.staffPickers}</strong>
          <small>Staff and content</small>
        </div>

        <div>
          <span>Custom access</span>
          <strong>{metrics.customOverrides}</strong>
          <small>Users with overrides</small>
        </div>
      </div>

      <div className="admin-users-viewbar">
        <div className="admin-users-view-switch" role="group" aria-label="Roster view">
          <button
            type="button"
            className={`btn text-xs px-3.5 py-1.5 font-bold transition-all ${
              viewMode === "split" ? "bg-primary text-white shadow-xs" : "btn-secondary"
            }`}
            onClick={() => setViewMode("split")}
          >
             Directory and detail
          </button>

          <button
            type="button"
            className={`btn text-xs px-3.5 py-1.5 font-bold transition-all ${
              viewMode === "table" ? "bg-primary text-white shadow-xs" : "btn-secondary"
            }`}
            onClick={() => setViewMode("table")}
          >
             Team table
          </button>
        </div>

        {canManageUsers && (
          <button
            type="button"
            className="btn bg-emerald-700 hover:bg-emerald-800 text-white text-xs py-1.5 px-3 font-bold shadow-xs"
            onClick={() => setShowWizard(true)}
          >
             <Plus aria-hidden="true" /> Add team member
          </button>
        )}
      </div>

      {/* WORKSPACE CONTENT AREA */}
      {viewMode === "table" ? (
        /* TABLE MATRIX VIEW */
        <div className="card p-4 overflow-x-auto border border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 mb-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <AdminSearchField
                  wrapperClassName="flex-1"
                  placeholder="Search team"
                  aria-label="Search team members"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
              />

              <select
                aria-label="Filter role"
                value={roleFilter}
                onChange={(e) => {
                   setRoleFilter(e.target.value as "ALL" | Role);
                  setCurrentPage(1);
                }}
                className="text-xs py-1.5 px-2 rounded-lg border border-line bg-surface font-semibold"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>
                <option value="STAFF">STAFF</option>
                <option value="CONTENT_CREATOR">CONTENT_CREATOR</option>
              </select>
            </div>

            <span className="text-xs muted font-semibold">Showing {filteredUsers.length} team members</span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line text-muted font-bold uppercase text-[10px] tracking-wider">
                <th className="pb-3 pt-1 px-3">Team Member</th>
                <th className="pb-3 pt-1 px-3">Role</th>
                <th className="pb-3 pt-1 px-3">Account Status</th>
                <th className="pb-3 pt-1 px-3">RBAC Overrides</th>
                <th className="pb-3 pt-1 px-3 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paginatedUsers.map((u) => {
                const grantedCount = u.customOverrides?.granted?.length ?? 0;
                const revokedCount = u.customOverrides?.revoked?.length ?? 0;
                const hasOverrides = grantedCount > 0 || revokedCount > 0;

                return (
                  <tr key={u.id} className="hover:bg-surface-muted/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                          {u.displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <strong className="text-ink font-bold block">{u.displayName}</strong>
                          <span className="muted text-[11px]">{u.email ?? "No email"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          u.role === "ADMIN"
                            ? "bg-purple-100 text-purple-900 border-purple-300"
                            : u.role === "MANAGER"
                            ? "bg-blue-100 text-blue-900 border-blue-300"
                            : u.role === "STAFF"
                            ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                            : "bg-surface-muted text-ink/80 border-line"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {u.active === false ? (
                        <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-300">
                          Suspended
                        </span>
                      ) : u.mustChangePassword ? (
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-300">
                          Must Reset Password
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-300">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {hasOverrides ? (
                        <div className="flex items-center gap-1.5">
                          {grantedCount > 0 && (
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                              +{grantedCount} Granted
                            </span>
                          )}
                          {revokedCount > 0 && (
                            <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-rose-200">
                              -{revokedCount} Revoked
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] muted">Role Defaults ({u.permissions.length})</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <AdminRowActionMenu
                        items={[
                          {
                            id: "view-rbac",
                            label: "View RBAC & Audit",
                            icon: <IconEye />,
                            onClick: () => {
                              void loadUserExtras(u.id);
                              setViewMode("split");
                            },
                          },
                          ...(canManageUsers
                            ? [
                                {
                                  id: "edit-profile",
                                  label: "Edit Profile",
                                  icon: <IconPencil />,
                                  onClick: () => {
                                    setEditingUser(u);
                                  },
                                },
                              ]
                            : []),
                          ...(canResetPasswords
                            ? [
                                {
                                  id: "reset-password",
                                  label: "Reset Password",
                                  icon: <IconLock />,
                                  onClick: () => {
                                    void handleResetPassword(u);
                                  },
                                },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center muted italic">
                    No team members match search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <AdminPagination
            page={currentPage}
            limit={pageSize}
            total={filteredUsers.length}
            onPageChange={setCurrentPage}
            onLimitChange={setPageSize}
            itemLabel="members"
          />
        </div>
      ) : (
        /* MASTER-DETAIL SPLIT WORKSPACE GRID */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT MASTER SIDEBAR (4 Cols) */}
          <aside className={`lg:col-span-4 card p-4 flex flex-col gap-3 max-h-[85vh] sticky top-4 ${
            mobileView === "detail" ? "hidden lg:flex" : "flex"
          }`}>
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div>
                <span className="eyebrow text-primary">TEAM ROSTER</span>
                <h2 className="text-base font-bold text-ink">User Directory ({filteredUsers.length})</h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AdminSearchField
                  wrapperClassName="flex-1"
                  placeholder="Search team"
                  aria-label="Search team members"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
              />

              <select
                aria-label="Filter role"
                value={roleFilter}
                onChange={(e) => {
                   setRoleFilter(e.target.value as "ALL" | Role);
                  setCurrentPage(1);
                }}
                className="text-xs py-1.5 px-2 rounded-lg border border-line bg-surface font-semibold"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>
                <option value="STAFF">STAFF</option>
                <option value="CONTENT_CREATOR">CONTENT_CREATOR</option>
              </select>
            </div>

            {/* USER ROSTER LIST */}
            <div
              className="overflow-y-auto flex flex-col divide-y divide-line pr-1 border border-line rounded-xl flex-1"
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.scrollTop + target.clientHeight >= target.scrollHeight - 40) {
                  if (splitLimit < filteredUsers.length) {
                    setSplitLimit((prev) => Math.min(prev + 20, filteredUsers.length));
                  }
                }
              }}
            >
              {sidebarDisplayedUsers.map((u) => {
                const isSelected = u.id === selectedUser?.id;

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => void loadUserExtras(u.id)}
                    className={`p-3 text-left transition-colors flex items-center justify-between gap-3 ${
                      isSelected ? "bg-primary/5 font-bold" : "hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-surface-muted border border-line flex items-center justify-center font-bold text-xs text-primary shrink-0">
                        {u.displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <strong className="text-ink text-xs block truncate font-bold">{u.displayName}</strong>
                        <span className="muted text-[11px] block truncate">{u.email ?? "No email"}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          u.role === "ADMIN"
                            ? "bg-purple-100 text-purple-900 border-purple-300"
                            : u.role === "MANAGER"
                            ? "bg-blue-100 text-blue-900 border-blue-300"
                            : u.role === "STAFF"
                            ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                            : "bg-surface-muted text-ink/80 border-line"
                        }`}
                      >
                        {u.role}
                      </span>
                      {u.active === false && (
                        <span className="text-[10px] text-danger font-bold">Suspended</span>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredUsers.length === 0 && (
                <p className="p-6 text-center text-xs muted italic">No users found.</p>
              )}
            </div>

            <AdminSidebarInfiniteFooter
              displayed={sidebarDisplayedUsers.length}
              total={filteredUsers.length}
              onLoadMore={() => setSplitLimit((prev) => Math.min(prev + 20, filteredUsers.length))}
              itemLabel="users"
            />
          </aside>

          {/* RIGHT DETAIL WORKSPACE (8 Cols) */}
          {selectedUser ? (
            <main className={`lg:col-span-8 flex flex-col gap-4 ${
              mobileView === "list" ? "hidden lg:flex" : "flex"
            }`}>
              {/* Mobile Back Header */}
              <div className="lg:hidden">
                <button
                  type="button"
                  className="btn btn-secondary text-xs px-3.5 py-2 font-bold flex items-center gap-1.5 w-full justify-center"
                  onClick={() => setMobileView("list")}
                >
                  <ArrowLeft aria-hidden="true" /> Back to team directory
                </button>
              </div>

              {/* USER OVERVIEW CARD */}
              <div className="card p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-lg font-black text-primary">
                      {selectedUser.displayName.slice(0, 1).toUpperCase()}
                    </div>

                    <div>
                      <span className="eyebrow text-primary">USER ACCESS PROFILE</span>
                      <h2 className="text-xl font-bold text-ink">{selectedUser.displayName}</h2>
                      <p className="text-xs muted">
                        {selectedUser.email ?? "No email registered"} · Joined{" "}
                        {selectedUser.createdAt?.slice(0, 10) ?? "Earlier"}
                      </p>
                    </div>
                  </div>

                  <div className="admin-user-profile-status">
                    <AdminStatusBadge status="NEUTRAL" label={selectedUser.role.replaceAll("_", " ")} />
                    <AdminStatusBadge status={selectedUser.active === false ? "CANCELLED" : selectedUser.mustChangePassword ? "UNPAID" : "CONFIRMED"} label={selectedUser.active === false ? "Suspended" : selectedUser.mustChangePassword ? "Password change required" : "Active"} />
                  </div>
                </div>

                <div className="admin-user-lifecycle-actions" aria-label="Account actions">
                  {canManageUsers && <button type="button" className="btn" onClick={() => setEditingUser(selectedUser)}><Pencil aria-hidden="true" />Edit profile and role</button>}
                  {canResetPasswords && <button type="button" className="btn btn-secondary" onClick={() => void handleResetPassword()}><KeyRound aria-hidden="true" />Reset password</button>}
                  {canManageUsers && <button type="button" className={`btn btn-secondary ${selectedUser.active !== false ? "text-danger" : ""}`} onClick={() => void handleToggleActive(selectedUser.active === false)}>{selectedUser.active !== false ? <><UserRoundX aria-hidden="true" />Suspend account</> : <><ShieldCheck aria-hidden="true" />Activate account</>}</button>}
              </div>

              <div className="admin-user-access-summary">
                <div>
                  <span>Role defaults <strong>{selectedDefaults.length}</strong></span>
                  <span>Effective permissions <strong>{selectedUser.permissions.length}</strong></span>
                  <span>Active sessions <strong>{sessions.length}</strong></span>
                </div>

                {canManageUsers && (
                  <button
                    type="button"
                    className="btn btn-secondary text-xs py-1 px-2.5 text-danger font-semibold"
                    disabled={sessions.length === 0}
                    onClick={() => void handleRevokeSessions()}
                  >
                    <LockKeyhole aria-hidden="true" /> Revoke all sessions
                  </button>
                )}
              </div>
            </div>

            <div className="card p-4 md:p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div>
                  <span className="eyebrow">Effective access</span>
                  <h3 className="text-base font-bold text-ink">Permissions by operational domain</h3>
                  <p className="text-xs muted">Role defaults provide the baseline. Custom changes are reviewed and saved together.</p>
                </div>

                {canAssignPermissions && (
                  <button
                    type="button"
                    className="btn btn-secondary text-xs py-1.5 px-3"
                    onClick={() => void handleResetToDefaults()}
                  >
                    <RefreshCcw aria-hidden="true" /> Reset overrides
                  </button>
                )}
              </div>

              {pendingPermissionCount > 0 && (
                <div className="admin-permission-savebar" role="status">
                  <div><strong>{pendingPermissionCount} unsaved {pendingPermissionCount === 1 ? "change" : "changes"}</strong><span>Review highlighted permissions before saving.</span></div>
                  <div><button type="button" className="btn btn-secondary" disabled={savingPermissions} onClick={() => setPendingPermissions({})}>Discard</button><button type="button" className="btn" disabled={savingPermissions} onClick={() => void savePermissionChanges()}><Save aria-hidden="true" />{savingPermissions ? "Saving…" : "Save access changes"}</button></div>
                </div>
              )}

              <div className="admin-permission-groups">
                {PERMISSION_GROUPS.map((group, groupIndex) => {
                  const GroupIcon = group.icon;
                  const grantedCount = group.permissions.filter((permission) => pendingPermissions[permission] ?? selectedUser.permissions.includes(permission)).length;
                  const pendingInGroup = group.permissions.filter((permission) => pendingPermissions[permission] !== undefined).length;
                  return <details key={group.label} open={groupIndex === 0}>
                    <summary>
                      <span><GroupIcon aria-hidden="true" /><strong>{group.label}</strong></span>
                      <span>{grantedCount} of {group.permissions.length} granted{pendingInGroup ? ` · ${pendingInGroup} pending` : ""}<ChevronDown aria-hidden="true" /></span>
                    </summary>

                    <div className="admin-permission-grid">
                      {group.permissions.map((permKey) => {
                        const isRoleDefault = selectedDefaults.includes(permKey);
                        const isGranted = pendingPermissions[permKey] ?? selectedUser.permissions.includes(permKey);
                        const isHighRisk = isHighRiskPermission(permKey);
                        const isPending = pendingPermissions[permKey] !== undefined;

                        const isCustomGranted =
                          selectedUser.customOverrides?.granted.includes(permKey);
                        const isCustomRevoked =
                          selectedUser.customOverrides?.revoked.includes(permKey);

                        return (
                          <div
                            key={permKey}
                            className={`admin-permission-row${isGranted ? " is-granted" : ""}${isPending ? " is-pending" : ""}`}
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-ink truncate">
                                  {permissionName(permKey)}
                                </span>
                                {isHighRisk && (
                                  <span title="High-risk permission" className="admin-permission-risk"><ShieldAlert aria-hidden="true" /></span>
                                )}
                              </div>

                              <span className="font-mono text-[10px] muted truncate">{permKey}</span>

                              <div className="flex items-center gap-1 mt-1">
                                {isRoleDefault && !isCustomRevoked && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-muted font-semibold muted border border-line">
                                    Role Default
                                  </span>
                                )}

                                {isCustomGranted && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-300">
                                    + Granted
                                  </span>
                                )}

                                {isCustomRevoked && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-900 font-bold border border-rose-300">
                                    - Revoked
                                  </span>
                                )}
                                {isPending && <span className="admin-status-badge admin-status-warning">Pending {isGranted ? "grant" : "revoke"}</span>}
                              </div>
                            </div>

                            {editable && (
                              <button
                                type="button"
                                className={`btn text-xs py-1 px-2.5 font-bold shrink-0 ${
                                  isGranted ? "btn-secondary text-danger" : "btn-primary"
                                }`}
                                onClick={() => stagePermission(permKey, !isGranted)}
                              >
                                {isGranted ? "Remove" : "Add"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>;
                })}
              </div>
            </div>

            {/* SESSIONS & AUDIT FEED SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active Sessions */}
              <div className="card p-4 flex flex-col gap-3">
                <h4 className="admin-user-panel-title"><LockKeyhole aria-hidden="true" /> Active sessions <span>{sessions.length}</span></h4>

                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {sessions.map((s) => (
                    <div key={s.id} className="p-2.5 bg-surface-muted rounded-xl border border-line text-xs font-mono">
                      <div className="font-bold text-ink truncate">{s.userAgent || "Browser Session"}</div>
                      <div className="muted text-[11px] flex justify-between mt-1">
                        <span>IP: {s.ipAddress || "Internal"}</span>
                        <span>{s.createdAt.slice(0, 10)}</span>
                      </div>
                    </div>
                  ))}

                  {sessions.length === 0 && (
                    <p className="text-xs muted italic p-2">No active browser sessions.</p>
                  )}
                </div>
              </div>

              {/* User Audit Feed */}
              <div className="card p-4 flex flex-col gap-3">
                <h4 className="admin-user-panel-title"><ClipboardList aria-hidden="true" /> User audit trail <span>{audit.length}</span></h4>

                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {audit.map((a) => (
                    <div key={a.id} className="p-2.5 bg-surface-muted rounded-xl border border-line text-xs">
                      <div className="font-bold text-ink">{a.action}</div>
                      <div className="muted text-[11px] flex justify-between mt-0.5 font-mono">
                        <span>By: {a.actor}</span>
                        <span>{a.createdAt.slice(0, 10)}</span>
                      </div>
                    </div>
                  ))}

                  {audit.length === 0 && (
                    <p className="text-xs muted italic p-2">No audit entries recorded.</p>
                  )}
                </div>
              </div>
            </div>
          </main>
        ) : (
          <main className="lg:col-span-8">
            <AdminEmptyState
              title="No User Selected"
              description="Select a user from the directory to view permissions and active sessions."
            />
          </main>
        )}
      </div>
    )}

      {/* 60-SECOND STAFF ONBOARDING WIZARD MODAL */}
      {showWizard && (
        <OnboardingModal
          actorRole={actorRole}
          onClose={() => setShowWizard(false)}
          onCreated={(createdUser, tempPassword) => {
            setShowWizard(false);
            setCreatedInfo({ user: createdUser, tempPassword });
            void refreshUsersList(createdUser.id);
          }}
        />
      )}

      {/* EDIT USER PROFILE MODAL */}
      {editingUser && (
        <div className="admin-dialog-backdrop">
          <div className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Pencil aria-hidden="true" /> Edit profile and role
              </h3>
              <button type="button" className="admin-dialog-close" aria-label="Close edit profile" onClick={() => setEditingUser(null)}>
                ×
              </button>
            </div>

            <form className="space-y-4 text-xs" onSubmit={(e) => void handleSaveUserEdit(e)}>
              <label className="field">
                <span>Display Name</span>
                <input name="displayName" defaultValue={editingUser.displayName} required minLength={2} maxLength={120} />
              </label>

              <label className="field">
                <span>Email Address</span>
                <div className="relative group">
                  <input name="email" type="email" defaultValue={editingUser.email ?? ""} readOnly aria-readonly="true" title="Email address cannot be changed here" className="w-full pr-9" />
                  <span title="Email address cannot be changed here"><LockKeyhole aria-label="Email address cannot be changed here" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" /></span>
                </div>
              </label>

              <label className="field">
                <span>Assigned Role</span>
                {(() => {
                  const roleLocked = (actorId !== undefined && editingUser.id === actorId && (actorRole === "ADMIN" || actorRole === "MANAGER")) || (actorRole !== "ADMIN" && editingUser.role === "ADMIN");
                  return (
                    <div className="relative">
                      <select name="role" defaultValue={editingUser.role} disabled={roleLocked} className={roleLocked ? "w-full pr-9" : "w-full"}>
                        <option value="ADMIN" disabled={actorRole !== "ADMIN"}>
                          {actorRole !== "ADMIN" ? "ADMIN (Requires Store Owner)" : "ADMIN"}
                        </option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="STAFF">STAFF</option>
                        <option value="CONTENT_CREATOR">CONTENT_CREATOR</option>
                      </select>
                      {roleLocked && <span title="Your role cannot be changed here"><LockKeyhole aria-label="Your role cannot be changed here" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" /></span>}
                    </div>
                  );
                })()}
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button className="btn btn-secondary text-xs" type="button" disabled={savingEdit} onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button className="btn text-xs font-bold min-w-[120px]" type="submit" disabled={savingEdit}>
                  {savingEdit ? "Saving…" : "Save profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEMPORARY PASSWORD COPY MODAL */}
      <AdminConfirmDialog
        open={confirmation !== null}
        title={confirmation?.title ?? "Confirm action"}
        description={confirmation?.description}
        confirmLabel={confirmation?.confirmLabel}
        destructive={confirmation?.destructive}
        onCancel={() => setConfirmation(null)}
        onConfirm={async () => { const action = confirmation?.onConfirm; setConfirmation(null); if (action) await action(); }}
      />

      {createdInfo && (
        <div className="admin-dialog-backdrop">
          <div ref={passwordDialogRef} className="admin-dialog card max-w-md w-full p-5 flex flex-col gap-3" role="dialog" aria-modal="true" aria-label="Temporary access password">
            <p className="eyebrow text-emerald-700">ACCOUNT CREATED / PASSWORD RESET</p>
            <h3 className="text-lg font-bold text-ink">Temporary Access Password</h3>
            <p className="text-xs muted leading-relaxed">
              Copy and share this temporary one-time password with <strong>{createdInfo.user.displayName}</strong> ({createdInfo.user.email}). User will be required to choose a new password on login.
            </p>

            <div className="p-3 bg-surface-muted border border-line rounded-xl flex items-center justify-between font-mono font-bold text-base text-primary">
              <span>{createdInfo.tempPassword}</span>
              <button
                type="button"
                className="btn btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1 font-bold"
                onClick={() => {
                  void navigator.clipboard.writeText(createdInfo.tempPassword);
                  setMessage("Temporary password copied to clipboard!");
                }}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
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
