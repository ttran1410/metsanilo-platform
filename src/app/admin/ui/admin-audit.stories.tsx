import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MasterAuditWorkspace } from "../audit/master-audit-workspace";
import { AdminEmptyState, AdminNotice, AdminPageHeader } from "../presentation";

const initialData = { items: [], total: 0, page: 1, limit: 15, totalPages: 1, actors: ["Aino Korhonen"], metrics: { highRisk: 1, sensitiveEdits: 3, opsActions: 18, failedLogins: 1, total7Days: 23 } };

function AuditStory({ canExportAudit = true }: { canExportAudit?: boolean }) {
  return <MasterAuditWorkspace initialData={initialData} canExportAudit={canExportAudit} />;
}

const meta = { title: "Admin / Audit", component: AuditStory, parameters: { layout: "fullscreen" }, argTypes: { canExportAudit: { control: "boolean" } } } satisfies Meta<typeof AuditStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ledger: Story = { args: { canExportAudit: true } };
export const ReadOnly: Story = { args: { canExportAudit: false } };

function AuditStateDemo({ state }: { state: "loading" | "empty" | "error" | "filtered" | "drawer" }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(false);
  const entries = [{ id: "audit-1", action: "product.updated", actor: "Aino Korhonen", detail: "Metsamustikka availability window changed", risk: "LOW" }, { id: "audit-2", action: "user.permissions_reset", actor: "Tomi Admin", detail: "Role defaults restored", risk: "HIGH" }];
  const visible = query ? entries.filter((entry) => `${entry.action} ${entry.actor}`.toLowerCase().includes(query.toLowerCase())) : entries;
  return <main className="admin-page-shell p-6"><AdminPageHeader eyebrow="IMMUTABLE APPEND LEDGER" title="Security & audit trail" description="Audit states with filters and preserved diff context." />
    {state === "loading" ? <div className="card p-8 text-sm muted" role="status">Loading audit entries…</div> : state === "empty" ? <AdminEmptyState title="No audit events" description="Events will appear here as operators make changes." /> : state === "error" ? <AdminNotice tone="error" live>Unable to load audit events. Retry without losing filters.</AdminNotice> : <><label className="field mt-4 max-w-sm"><span>Search audit</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Action or actor" /></label>{state === "filtered" && !visible.length ? <AdminEmptyState title="No matching events" description="Clear the search to return to the ledger." /> : <div className="card mt-4 p-4 text-sm">{visible.map((entry) => <button key={entry.id} type="button" className="w-full flex items-center justify-between gap-3 border-b border-line py-3 text-left" onClick={() => setSelected(true)}><span><strong>{entry.action}</strong><span className="block text-xs muted">{entry.actor} · {entry.detail}</span></span><span className={entry.risk === "HIGH" ? "text-rose-700 font-bold" : "muted"}>{entry.risk}</span></button>)}{selected && <AdminNotice tone="neutral" live>Diff drawer open. The active ledger context remains visible behind the drawer.</AdminNotice>}</div>}</>}</main>;
}

export const Loading: Story = { render: () => <AuditStateDemo state="loading" /> };
export const Empty: Story = { render: () => <AuditStateDemo state="empty" /> };
export const Error: Story = { render: () => <AuditStateDemo state="error" /> };
export const Filtered: Story = { render: () => <AuditStateDemo state="filtered" /> };
export const DiffDrawer: Story = { render: () => <AuditStateDemo state="drawer" /> };
