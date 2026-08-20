import type { Meta, StoryObj } from "@storybook/react";
import { MasterDetailUserWorkspace, type UserRow } from "../users/master-detail-workspace";

const initialUsers: UserRow[] = [{ id: "story-user", email: "aino@metsanilo.local", displayName: "Aino Korhonen", role: "MANAGER", active: true, mustChangePassword: false, sessionVersion: 1, createdAt: "2026-01-01T10:00:00.000Z", permissions: ["orders.read", "availability.read"], customOverrides: { granted: [], revoked: [] } }];

function UsersStory({ canManageUsers = true, canAssignPermissions = true, canResetPasswords = true }: { canManageUsers?: boolean; canAssignPermissions?: boolean; canResetPasswords?: boolean }) {
  return <MasterDetailUserWorkspace initialUsers={initialUsers} actorRole="ADMIN" canManageUsers={canManageUsers} canAssignPermissions={canAssignPermissions} canResetPasswords={canResetPasswords} />;
}

const meta = { title: "Admin / Users", component: UsersStory, parameters: { layout: "fullscreen" }, argTypes: { canManageUsers: { control: "boolean" }, canAssignPermissions: { control: "boolean" }, canResetPasswords: { control: "boolean" } } } satisfies Meta<typeof UsersStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PermissionMatrix: Story = { args: { canManageUsers: true, canAssignPermissions: true, canResetPasswords: true } };
export const ReadOnly: Story = { args: { canManageUsers: false, canAssignPermissions: false, canResetPasswords: false } };
