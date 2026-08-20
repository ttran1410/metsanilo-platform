import type { Meta, StoryObj } from "@storybook/react";
import { AdminOverview } from "./overview";
import type { DashboardData } from "./dashboard";

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
  financials: { grossBookedCents: 284000, collectedCents: 198800, outstandingCents: 85200, collectedPercentage: 70 },
  lookahead: [
    { label: "Today", date: "2026-08-20", capacityLitres: 120, reservedLitres: 82.4, remainingLitres: 37.6, percentage: 68 },
    { label: "Tomorrow", date: "2026-08-21", capacityLitres: 120, reservedLitres: 91.2, remainingLitres: 28.8, percentage: 76 },
    { label: "Saturday", date: "2026-08-22", capacityLitres: 100, reservedLitres: 94, remainingLitres: 6, percentage: 94 },
  ],
  attention: [],
  activity: [],
};

const meta = { title: "Admin / Overview", component: AdminOverview, parameters: { layout: "fullscreen" } } satisfies Meta<typeof AdminOverview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HarvestDay: Story = { args: { initialData: fixture } };
export const QuietDay: Story = { args: { initialData: { ...fixture, attentionCount: 0, unreadNotifications: 0, overdueNew: [], unconfirmedDeliveryCount: 0 } } };
