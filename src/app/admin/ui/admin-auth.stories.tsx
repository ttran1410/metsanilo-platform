import type { Meta, StoryObj } from "@storybook/react";
import { LoginForm } from "../login/form";
import { ForcedPasswordForm } from "../change-password/form";
import { AdminNotice, AdminPageHeader } from "../presentation";

const meta = { title: "Admin / Auth", component: LoginForm, parameters: { layout: "fullscreen" } } satisfies Meta<typeof LoginForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Login: Story = {};
export const LoginWithPasswordError: Story = {
  render: () => <main className="admin-login-shell"><div className="admin-login-card"><AdminNotice tone="error" live>Invalid email or password. Check your details and try again.</AdminNotice><LoginForm /></div></main>,
};

export const ForcedPasswordChange: Story = { render: () => <ForcedPasswordForm /> };

function AuthStateDemo({ state }: { state: "loading" | "sessionExpired" | "success" }) {
  return <main className="shell py-10"><AdminPageHeader eyebrow="SECURITY" title="Authentication state" description="Clear recovery paths for sign-in and session boundaries." />{state === "loading" ? <div className="card p-8 text-sm muted" role="status">Signing in...</div> : state === "sessionExpired" ? <AdminNotice tone="warning" live>Your session expired. Sign in again to continue.</AdminNotice> : <AdminNotice tone="success" live>Password changed. You can continue to the admin portal.</AdminNotice>}</main>;
}

export const Loading: Story = { render: () => <AuthStateDemo state="loading" /> };
export const SessionExpired: Story = { render: () => <AuthStateDemo state="sessionExpired" /> };
export const PasswordChanged: Story = { render: () => <AuthStateDemo state="success" /> };
