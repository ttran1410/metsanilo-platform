import type { Meta, StoryObj } from "@storybook/react";

const sections = ["Shop identity", "Fulfillment hubs", "Payment methods", "Order channels", "Storefront & media", "System & safety"];

function SettingsPreview({ readOnly = false }: { readOnly?: boolean }) {
  return <main className="admin-settings-workspace shell pb-20 flex flex-col gap-5"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4"><div><p className="eyebrow">Administration</p><h1>Operational settings</h1><p className="admin-section-description">Configure the business surface once, then keep daily operations predictable.</p></div><button className="btn btn-secondary" type="button">View live storefront</button></div>{readOnly && <div className="card p-3 text-sm">Read-only access. An administrator or manager must change operational settings.</div>}<nav className="flex items-center gap-1 overflow-x-auto p-1 bg-surface-muted border border-line rounded-2xl">{sections.map((section, index) => <button className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap ${index === 0 ? "bg-surface text-primary shadow-xs" : "text-muted"}`} type="button" key={section}>{section}</button>)}</nav><section className="card p-5 grid gap-5"><div><p className="eyebrow">Shop identity</p><h2>Brand and customer care</h2><p className="text-sm muted">Public names, legal details, and direct support lines shown across the storefront.</p></div><div className="grid gap-4 md:grid-cols-2"><label className="field"><span>Finnish shop name</span><input disabled={readOnly} defaultValue="Metsänilo" /></label><label className="field"><span>English shop name</span><input disabled={readOnly} defaultValue="Metsänilo" /></label><label className="field"><span>Customer phone</span><input disabled={readOnly} defaultValue="+358 40 123 4567" /></label><label className="field"><span>Support email</span><input disabled={readOnly} defaultValue="hello@metsanilo.fi" /></label></div><div className="profile-actions"><button className="btn btn-secondary" type="button">Manage brand assets</button>{!readOnly && <button className="btn" type="button">Save identity</button>}</div></section></main>;
}

const meta = { title: "Admin / Settings", component: SettingsPreview, parameters: { layout: "fullscreen" }, argTypes: { readOnly: { control: "boolean" } } } satisfies Meta<typeof SettingsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editable: Story = { args: { readOnly: false } };
export const ReadOnly: Story = { args: { readOnly: true } };
