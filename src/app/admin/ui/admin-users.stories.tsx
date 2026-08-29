import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { UsersWorkspace, type UserRow } from "../users/users-workspace";
import { AdminEmptyState, AdminNotice, AdminPageHeader } from "../presentation";

const initialUsers: UserRow[] = [{ id: "story-user", email: "aino@metsanilo.local", displayName: "Aino Korhonen", role: "MANAGER", active: true, mustChangePassword: false, sessionVersion: 1, createdAt: "2026-01-01T10:00:00.000Z", permissions: ["orders.read", "availability.read"], customOverrides: { granted: [], revoked: [] } }];

function UsersStory({ canManageUsers = true, canAssignPermissions = true, canResetPasswords = true }: { canManageUsers?: boolean; canAssignPermissions?: boolean; canResetPasswords?: boolean }) {
  return <UsersWorkspace initialUsers={initialUsers} actorRole="ADMIN" canManageUsers={canManageUsers} canAssignPermissions={canAssignPermissions} canResetPasswords={canResetPasswords} />;
}

const meta = { title: "Admin / Users", component: UsersStory, parameters: { layout: "fullscreen" }, argTypes: { canManageUsers: { control: "boolean" }, canAssignPermissions: { control: "boolean" }, canResetPasswords: { control: "boolean" } } } satisfies Meta<typeof UsersStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PermissionMatrix: Story = { args: { canManageUsers: true, canAssignPermissions: true, canResetPasswords: true } };
export const ReadOnly: Story = { args: { canManageUsers: false, canAssignPermissions: false, canResetPasswords: false } };

function UserStateDemo({ state }: { state: "loading" | "empty" | "error" | "filtered" | "success" | "conflict" }) {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState(state === "success" ? "Permissions saved." : state === "conflict" ? "The user changed elsewhere. Reload before retrying." : "");
  const visible = query ? initialUsers.filter((user) => user.displayName.toLowerCase().includes(query.toLowerCase())) : initialUsers;

  return <main className="admin-page-shell p-6"><AdminPageHeader eyebrow="ACCESS CONTROL" title="Users & permissions" description="Deterministic Storybook states for the access workspace." />
    {state === "loading" ? <div className="card p-8 text-sm muted" role="status">Loading users…</div> : state === "empty" ? <AdminEmptyState title="No users found" description="Invite a staff member to begin managing access." /> : state === "error" ? <AdminNotice tone="error" live>Unable to load users. Retry the request.</AdminNotice> : <>
      {notice && <AdminNotice tone={state === "conflict" ? "warning" : "success"} live>{notice}</AdminNotice>}
      <label className="field mt-4 max-w-sm"><span>Search users</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" /></label>
      {state === "filtered" && !visible.length ? <AdminEmptyState title="No matching users" description="Clear the search to return to the access list." /> : <div className="card mt-4 p-4 text-sm">{visible.map((user) => <div key={user.id} className="flex items-center justify-between border-b border-line py-3"><strong>{user.displayName}</strong><span>{user.role}</span></div>)}<button type="button" className="btn mt-4" onClick={() => setNotice("Permissions saved.")}>Save permissions</button></div>}
    </>}</main>;
}

export const Loading: Story = { render: () => <UserStateDemo state="loading" /> };
export const Empty: Story = { render: () => <UserStateDemo state="empty" /> };
export const Error: Story = { render: () => <UserStateDemo state="error" /> };
export const Filtered: Story = { render: () => <UserStateDemo state="filtered" /> };
export const MutationSuccess: Story = { render: () => <UserStateDemo state="success" /> };
export const MutationConflict: Story = { render: () => <UserStateDemo state="conflict" /> };
