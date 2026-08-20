import type { Meta, StoryObj } from "@storybook/react";
import { ProfileForm } from "../profile/form";
import { AdminEmptyState, AdminNotice, AdminPageHeader } from "../presentation";

const profile = { displayName: "Aino Korhonen", email: "aino@metsanilo.local", username: "aino", role: "MANAGER", active: true };

const meta = { title: "Admin / Profile", component: ProfileForm, parameters: { layout: "fullscreen" } } satisfies Meta<typeof ProfileForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Account: Story = { args: { initial: profile } };
export const InactiveAccount: Story = { args: { initial: { ...profile, active: false } } };

function ProfileStateDemo({ state }: { state: "loading" | "error" | "permission" | "success" }) {
  if (state === "loading") return <main className="shell py-10"><div className="card p-8 text-sm muted" role="status">Loading profile...</div></main>;
  if (state === "error") return <main className="shell py-10"><AdminNotice tone="error" live>Profile update failed. Review the fields and retry.</AdminNotice></main>;
  if (state === "permission") return <main className="shell py-10"><AdminNotice tone="error" live>You do not have permission to edit this profile.</AdminNotice></main>;
  return <main className="shell py-10"><AdminPageHeader eyebrow="PERSONAL DETAILS" title="Profile" description="Your account identity and security entry points." /><AdminNotice tone="success" live>Profile updated.</AdminNotice><AdminEmptyState title="No pending changes" description="The saved profile is current." /></main>;
}

export const Loading: Story = { args: { initial: profile }, render: () => <ProfileStateDemo state="loading" /> };
export const MutationError: Story = { args: { initial: profile }, render: () => <ProfileStateDemo state="error" /> };
export const PermissionLimited: Story = { args: { initial: profile }, render: () => <ProfileStateDemo state="permission" /> };
export const MutationSuccess: Story = { args: { initial: profile }, render: () => <ProfileStateDemo state="success" /> };
