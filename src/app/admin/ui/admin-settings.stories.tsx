import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { OperationsSettings } from "../settings/settings-module";
import { AdminNotice, AdminPageHeader } from "../presentation";

function SettingsStory({ canManageSettings = true }: { canManageSettings?: boolean }) {
  return <OperationsSettings canManageSettings={canManageSettings} canManageTheme={canManageSettings} />;
}

const meta = { title: "Admin / Settings", component: SettingsStory, parameters: { layout: "fullscreen" }, argTypes: { canManageSettings: { control: "boolean" } } } satisfies Meta<typeof SettingsStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editable: Story = { args: { canManageSettings: true } };
export const ReadOnly: Story = { args: { canManageSettings: false } };

function SettingsStateDemo({ state }: { state: "loading" | "limited" | "success" | "conflict" }) {
  const [notice, setNotice] = useState(state === "success" ? "Shop settings saved." : state === "conflict" ? "Settings changed elsewhere. Reload before retrying." : "");
  return <main className="admin-page-shell p-6"><AdminPageHeader eyebrow="SYSTEM CONFIGURATION" title="Settings" description="Operational settings and recoverable mutation states." />
    {state === "loading" ? <div className="card p-8 text-sm muted" role="status">Loading shop settings…</div> : state === "limited" ? <AdminNotice tone="warning" live>You can view settings, but you do not have permission to change operational configuration.</AdminNotice> : <section className="card mt-4 p-4 max-w-xl"><label className="field"><span>Shop display name</span><input defaultValue="Metsänilo" disabled={state === "conflict"} /></label>{notice && <AdminNotice tone={state === "conflict" ? "warning" : "success"} live>{notice}</AdminNotice>}<div className="flex gap-2 mt-4"><button type="button" className="btn" onClick={() => setNotice("Shop settings saved.")}>Save settings</button>{state === "conflict" && <button type="button" className="btn btn-secondary" onClick={() => setNotice("Latest settings loaded.")}>Reload latest</button>}</div></section>}</main>;
}

export const Loading: Story = { render: () => <SettingsStateDemo state="loading" /> };
export const PermissionLimited: Story = { render: () => <SettingsStateDemo state="limited" /> };
export const MutationSuccess: Story = { render: () => <SettingsStateDemo state="success" /> };
export const MutationConflict: Story = { render: () => <SettingsStateDemo state="conflict" /> };
