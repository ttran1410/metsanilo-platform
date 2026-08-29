import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { AvailabilityWorkspace as AvailabilityData } from "@/domain/availability";
import { AvailabilityWorkspace } from "../availability/availability-workspace";
import { AdminNotice, AdminPageHeader } from "../presentation";

const dates = ["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26"];
const product = { id: "story-product", shopId: "story-shop", code: "BERRY-01", slug: "metsamustikka", nameFi: "Metsamustikka", nameEn: "Wild blueberry", descriptionFi: "", descriptionEn: "", active: true, availableFrom: "2026-07-01", availableThrough: "2026-09-30", showOnHomepage: true, showOnReserve: true, sortOrder: 0 };

const fixture = (soldOut = false): AvailabilityData => ({
  startDate: dates[0], endDate: dates[dates.length - 1], dates,
  products: [product],
  rows: dates.map((businessDate, index) => {
    const capacityMl = index === 2 ? 80000 : 100000;
    const reservedMl = soldOut && index === 2 ? capacityMl : index === 1 ? 82000 : index === 3 ? 0 : 42000;
    return { availability: { id: `story-availability-${businessDate}`, shopId: "story-shop", productId: product.id, businessDate, capacityMl, reservedMl, acceptsOrders: !soldOut || index !== 2, manualSoldOut: soldOut && index === 2, manualSoldOutReason: soldOut && index === 2 ? "Weather lock" : null, version: 1, updatedAt: "2026-08-20T10:00:00.000Z" }, product, remainingMl: Math.max(0, capacityMl - reservedMl), utilization: Math.round((reservedMl / capacityMl) * 100), nearCapacity: reservedMl >= capacityMl * .8, soldOut: soldOut && index === 2, packages: [] };
  }),
  ordersByDate: {},
  queues: { picking: [], pickup: [], delivery: [] },
} as unknown as AvailabilityData);

function AvailabilityStory({ soldOut = false, canManage = true }: { soldOut?: boolean; canManage?: boolean }) {
  return <AvailabilityWorkspace initialWorkspace={fixture(soldOut)} canManage={canManage} canSoldOut={canManage} canCutoffOverride={canManage} />;
}

const meta = { title: "Admin / Availability", component: AvailabilityStory, parameters: { layout: "fullscreen" }, argTypes: { soldOut: { control: "boolean" }, canManage: { control: "boolean" } } } satisfies Meta<typeof AvailabilityStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PlanningWindow: Story = { args: { soldOut: false, canManage: true } };
export const SoldOutException: Story = { args: { soldOut: true, canManage: true } };
export const ReadOnly: Story = { args: { soldOut: false, canManage: false } };

function AvailabilitySafetyDemo({ state }: { state: "loading" | "error" | "preview" | "closed" | "conflict" }) {
  const [closed, setClosed] = useState(state === "closed");
  const [notice, setNotice] = useState("");
  return <main className="admin-page-shell p-6"><AdminPageHeader eyebrow="HARVEST CAPACITY" title="Availability safety" description="Preview capacity changes, close/reopen dates, and recover from stale versions." />
    {state === "loading" ? <div className="card p-8 text-sm muted" role="status">Loading capacity workspace…</div> : state === "error" ? <AdminNotice tone="error" live>Unable to load availability. Retry the workspace.</AdminNotice> : <section className="card mt-4 p-4"><div className="flex items-center justify-between"><div><h2 className="font-bold">20 Aug · Metsamustikka</h2><p className="text-xs muted">82 L reserved of 100 L · version 4</p></div><span className={`badge ${closed ? "badge-muted" : "badge-success"}`}>{closed ? "CLOSED" : "OPEN"}</span></div>{notice && <AdminNotice tone={state === "conflict" ? "warning" : "success"} live>{notice}</AdminNotice>}{state === "preview" && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">Preview: capacity decreases by 10 L. 82 L remains reserved, so the change is allowed.</div>}{state === "conflict" && <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs">This date changed in another session. Current version is 5.</div>}<div className="flex flex-wrap gap-2 mt-4"><button type="button" className="btn" onClick={() => { setClosed((current) => !current); setNotice(closed ? "Date reopened for reservations." : "Date closed. Existing reservations remain protected."); }}>{closed ? "Reopen date" : "Close date"}</button>{state === "conflict" && <button type="button" className="btn btn-secondary" onClick={() => setNotice("Latest availability loaded.")}>Reload latest</button>}</div></section>}</main>;
}

export const Loading: Story = { render: () => <AvailabilitySafetyDemo state="loading" /> };
export const Error: Story = { render: () => <AvailabilitySafetyDemo state="error" /> };
export const MutationPreview: Story = { render: () => <AvailabilitySafetyDemo state="preview" /> };
export const CloseReopen: Story = { render: () => <AvailabilitySafetyDemo state="closed" /> };
export const MutationConflict: Story = { render: () => <AvailabilitySafetyDemo state="conflict" /> };
