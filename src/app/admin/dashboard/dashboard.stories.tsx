import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { AdminDashboard } from "./dashboard-workspace";
import type { DashboardData } from "./types";
import { AdminEmptyState, AdminLoadingState, AdminNotice, AdminPageHeader } from "../presentation";

const fixture: DashboardData = {
  businessDate: "Thursday, 20 August",
  asOf: "2026-08-20T09:42:00+03:00",
  unreadNotifications: 2,
  attentionCount: 3,
  overdueNew: [
    { id: "order-1042", publicReference: "MN-1042", customerName: "Liisa Korhonen", createdAt: "2026-08-20T09:20:00+03:00", ageMinutes: 22, mobile: "+358 40 123 4567", version: 2 },
  ],
  unconfirmedDeliveryCount: 1,
  funnel: {
    intake: { count: 8, volumeLitres: 18.4 },
    confirm: { count: 24, volumeLitres: 52.1 },
    packing: { count: 12, volumeLitres: 31.2 },
    ready: { count: 9, volumeLitres: 22.7 },
    done: { count: 31, volumeLitres: 74.3 },
  },
  volume: { capacityLitres: 120, reservedLitres: 82.4, remainingLitres: 37.6, percentage: 68, pickupVolumeLitres: 46.2, pickupCrates: 14, deliveryVolumeLitres: 36.2, deliveryCrates: 9 },
  financials: { grossBookedCents: 284000, collectedCents: 198800, outstandingCents: 85200, collectedPercentage: 70, fulfilledSalesCents: 240000, fulfilledLitres: 74.3 },
  lookahead: [
    { label: "Today", date: "2026-08-20", capacityLitres: 120, reservedLitres: 82.4, remainingLitres: 37.6, percentage: 68 },
    { label: "Tomorrow", date: "2026-08-21", capacityLitres: 120, reservedLitres: 91.2, remainingLitres: 28.8, percentage: 76 },
    { label: "Saturday", date: "2026-08-22", capacityLitres: 100, reservedLitres: 94, remainingLitres: 6, percentage: 94 },
  ],
  attention: [],
  activity: [],
};

const meta = { title: "Admin / Dashboard", component: AdminDashboard, parameters: { layout: "fullscreen" }, tags: ["autodocs"] } satisfies Meta<typeof AdminDashboard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HarvestDay: Story = { args: { initialData: fixture } };
export const QuietDay: Story = { args: { initialData: { ...fixture, attentionCount: 0, unreadNotifications: 0, overdueNew: [], unconfirmedDeliveryCount: 0 } } };

function OverviewStateDemo({ state }: { state: "loading" | "error" | "permission" | "mutation" | "mobile" }) {
  const [notice, setNotice] = useState(state === "mutation" ? "Order MN-1042 confirmed." : "");
  if (state === "loading") return <main className="admin-overview"><AdminLoadingState label="Loading today's operations..." /></main>;
  if (state === "error") return <main className="admin-overview"><div className="admin-overview-error" role="alert"><strong>Dashboard unavailable</strong><span>Dashboard data could not be loaded.</span><button className="btn btn-secondary" type="button">Try again</button></div></main>;
  if (state === "permission") return <main className="shell py-10"><AdminNotice tone="error" live>You do not have access to the dashboard.</AdminNotice></main>;
  if (state === "mobile") return <div className="max-w-sm"><AdminDashboard initialData={fixture} /></div>;
  return <main className="admin-page-shell p-6"><AdminPageHeader eyebrow="LIVE OPERATIONS" title="Overview feedback" description="Mutation feedback remains visible while the dashboard refreshes." />{notice && <AdminNotice tone="success" live>{notice}</AdminNotice>}<AdminEmptyState title="No overdue orders" description="The queue is clear for now." /><button type="button" className="btn" onClick={() => setNotice("Dashboard refreshed from the authoritative response.")}>Refresh overview</button></main>;
}

export const Loading: Story = { render: () => <OverviewStateDemo state="loading" /> };
export const ErrorRecovery: Story = { render: () => <OverviewStateDemo state="error" /> };
export const PermissionLimited: Story = { render: () => <OverviewStateDemo state="permission" /> };
export const MutationFeedback: Story = { render: () => <OverviewStateDemo state="mutation" /> };
export const Mobile: Story = { render: () => <OverviewStateDemo state="mobile" />, parameters: { viewport: { defaultViewport: "mobile1" } } };
export const KeyboardFocus: Story = { args: { initialData: fixture }, parameters: { a11y: { element: ".admin-overview" } } };
export const ReducedMotion: Story = { args: { initialData: fixture }, parameters: { reducedMotion: "reduce" } };
