import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MasterDetailCustomerWorkspace } from "../customers/master-detail-workspace";
import { AdminEmptyState, AdminNotice, AdminPageHeader } from "../presentation";

const initialCustomers = [{
  id: "story-customer", name: "Aino Korhonen", mobile: "+358 40 123 4567", email: "aino@example.com", matchStatus: "MATCHED", marketingConsent: true, marketingConsentStatus: "GRANTED", marketingConsentAt: "2026-08-01T10:00:00.000Z", marketingConsentSource: "PUBLIC_FORM", marketingConsentUpdatedBy: null, notes: "Prefers pickup.", facebookProfile: null, updatedAt: "2026-08-20T10:00:00.000Z", metrics: { totalOrders: 12, completedOrders: 11, noShowCount: 0, reliabilityRatePercent: 100, lifetimeLitres: 48, totalSpendCents: 31200, lastFulfillmentDate: "2026-08-20", isVip: true, preferredMethod: "PICKUP" as const, reviewCount: 3, averageRating: 4.8, primaryAddress: "Pori" },
}];

function CustomersStory({ canEdit = true, canAnonymize = true, canRetention = true }: { canEdit?: boolean; canAnonymize?: boolean; canRetention?: boolean }) {
  return <MasterDetailCustomerWorkspace initialCustomers={initialCustomers} canEdit={canEdit} canAnonymize={canAnonymize} canRetention={canRetention} />;
}

const meta = { title: "Admin / Customers", component: CustomersStory, parameters: { layout: "fullscreen" }, argTypes: { canEdit: { control: "boolean" }, canAnonymize: { control: "boolean" } } } satisfies Meta<typeof CustomersStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Customer360: Story = { args: { canEdit: true, canAnonymize: true } };
export const ReadOnly: Story = { args: { canEdit: false, canAnonymize: false } };

function CustomerStateDemo({ state }: { state: "loading" | "empty" | "error" | "filtered" | "success" | "conflict" }) {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState(state === "success" ? "Customer profile saved." : state === "conflict" ? "The profile changed elsewhere. Reload before retrying." : "");
  const visible = query ? initialCustomers.filter((customer) => customer.name.toLowerCase().includes(query.toLowerCase())) : initialCustomers;
  return <main className="admin-page-shell p-6"><AdminPageHeader eyebrow="CUSTOMER 360" title="Customers" description="Search identity, order history, consent, and profile actions." />
    {state === "loading" ? <div className="card p-8 text-sm muted" role="status">Loading customers...</div> : state === "empty" ? <AdminEmptyState title="No customers yet" description="Customers appear here after the first order or contact submission." /> : state === "error" ? <AdminNotice tone="error" live>Unable to load customers. Retry without losing the current search.</AdminNotice> : <><label className="field mt-4 max-w-sm"><span>Search customers</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or mobile" /></label>{notice && <AdminNotice tone={state === "conflict" ? "warning" : "success"} live>{notice}</AdminNotice>}{state === "filtered" && !visible.length ? <AdminEmptyState title="No matching customers" description="Clear the search to return to the customer list." /> : <div className="card mt-4 p-4 text-sm">{visible.map((customer) => <div key={customer.id} className="flex items-center justify-between border-b border-line py-3"><div><strong>{customer.name}</strong><span className="block text-xs muted">{customer.mobile} · {customer.metrics.totalOrders} orders</span></div><span>{customer.matchStatus}</span></div>)}<button type="button" className="btn mt-4" onClick={() => setNotice("Customer profile saved.")}>Save profile</button>{state === "conflict" && <button type="button" className="btn btn-secondary mt-4 ml-2" onClick={() => setNotice("Latest customer profile loaded.")}>Reload latest</button>}</div>}</>}</main>;
}

export const Loading: Story = { render: () => <CustomerStateDemo state="loading" /> };
export const Empty: Story = { render: () => <CustomerStateDemo state="empty" /> };
export const Error: Story = { render: () => <CustomerStateDemo state="error" /> };
export const Filtered: Story = { render: () => <CustomerStateDemo state="filtered" /> };
export const MutationSuccess: Story = { render: () => <CustomerStateDemo state="success" /> };
export const MutationConflict: Story = { render: () => <CustomerStateDemo state="conflict" /> };
