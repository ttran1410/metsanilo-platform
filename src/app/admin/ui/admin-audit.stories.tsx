import type { Meta, StoryObj } from "@storybook/react";

const events = [
  { time: "Today 14:32", actor: "Tuan Huynh", action: "ORDER_STATUS_CHANGED", target: "M-1048", severity: "Standard" },
  { time: "Today 13:18", actor: "Aino Korhonen", action: "PRICE_OVERRIDE", target: "pkg-berry-1l", severity: "Sensitive" },
  { time: "Yesterday 18:42", actor: "Unknown", action: "LOGIN_FAILED", target: "admin@...", severity: "High risk" },
];

function AuditPreview({ filtered = false }: { filtered?: boolean }) {
  const visibleEvents = filtered ? events.filter((event) => event.severity === "High risk") : events;
  return <main className="admin-audit-workspace shell pb-10 flex flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3"><div><p className="eyebrow">Immutable append ledger</p><h1>Security &amp; audit trail</h1><p className="admin-section-description">Trace sensitive changes, access anomalies, and operational decisions.</p></div><div className="flex gap-2"><button className="btn btn-secondary" type="button">Export CSV</button><button className="btn btn-secondary" type="button">Export JSON</button></div></div><div className="grid gap-3 grid-cols-2 md:grid-cols-4"><div className="card p-3.5"><span className="eyebrow">High-risk events</span><strong className="text-2xl">3</strong><small>Permissions &amp; GDPR</small></div><div className="card p-3.5"><span className="eyebrow">Sensitive edits</span><strong className="text-2xl">8</strong><small>Prices &amp; refunds</small></div><div className="card p-3.5"><span className="eyebrow">Ops actions</span><strong className="text-2xl">42</strong><small>Order changes</small></div><div className="card p-3.5"><span className="eyebrow">Failed logins</span><strong className="text-2xl">1</strong><small>Auth status</small></div></div><section className="card p-4"><div className="flex flex-wrap gap-2"><input className="flex-1 min-w-[16rem]" aria-label="Search audit logs" placeholder="Search keyword, entity ID, or actor" /><select aria-label="Risk level"><option>All risk levels</option><option>High risk</option></select><select aria-label="Date range"><option>Last 7 days</option><option>Last 24 hours</option></select></div><div className="overflow-x-auto mt-4"><table className="w-full text-left text-xs"><thead><tr><th className="p-3">Timestamp</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Risk</th></tr></thead><tbody>{visibleEvents.map((event) => <tr className="border-b border-line" key={event.time}><td className="p-3">{event.time}</td><td className="p-3">{event.actor}</td><td className="p-3 font-mono">{event.action}</td><td className="p-3 font-mono">{event.target}</td><td className="p-3"><span className="pill">{event.severity}</span></td></tr>)}</tbody></table></div></section></main>;
}

const meta = { title: "Admin / Audit", component: AuditPreview, parameters: { layout: "fullscreen" }, argTypes: { filtered: { control: "boolean" } } } satisfies Meta<typeof AuditPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ledger: Story = { args: { filtered: false } };
export const HighRiskFilter: Story = { args: { filtered: true } };
