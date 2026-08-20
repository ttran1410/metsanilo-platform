import type { Meta, StoryObj } from "@storybook/react";
import type { AvailabilityWorkspace as AvailabilityData } from "@/domain/availability";
import { AvailabilityWorkspace } from "../availability/workspace";

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
  return <AvailabilityWorkspace initialWorkspace={fixture(soldOut)} canManage={canManage} canSoldOut={canManage} />;
}

const meta = { title: "Admin / Availability", component: AvailabilityStory, parameters: { layout: "fullscreen" }, argTypes: { soldOut: { control: "boolean" }, canManage: { control: "boolean" } } } satisfies Meta<typeof AvailabilityStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PlanningWindow: Story = { args: { soldOut: false, canManage: true } };
export const SoldOutException: Story = { args: { soldOut: true, canManage: true } };
export const ReadOnly: Story = { args: { soldOut: false, canManage: false } };
