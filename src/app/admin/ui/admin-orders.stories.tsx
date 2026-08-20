import type { Meta, StoryObj } from "@storybook/react";
import { OrdersListing, type AdminOrder, type OrdersView } from "../orders-listing";

const baseOrder: AdminOrder = {
  id: "story-order-1048", shopId: "story-shop", publicReference: "M-1048", idempotencyKey: "story-key-1048",
  productId: "story-product", packageId: "story-package", customerId: null, seasonId: null,
  productNameFi: "Metsamustikka", productNameEn: "Wild blueberry", packageLabelFi: "1 litra", packageLabelEn: "1 litre",
  quantity: 1, volumeMl: 1000, itemSubtotalCents: 4800, deliveryFeeCents: 0, finalTotalCents: 4800,
  fulfillmentDate: "2026-08-20", fulfillmentMethod: "PICKUP", customerName: "Aino Korhonen", mobile: "+358 40 123 4567", email: "aino@example.com",
  streetAddress: null, postalCode: null, city: "Pori", pickupName: "Toriparkki", pickupAddress: "Pori", pickupInstructions: "Entrance B", pickupTime: "14:30",
  pickupLocationSnapshotJson: null, deliveryOriginSnapshotJson: null, notes: null, facebookProfile: null, orderSource: "WEBSITE", historicalEntry: false,
  statusReason: null, contactedAt: null, contactedBy: null, contactChannel: null, fulfillmentStartedAt: null, readyAt: null, dispatchedAt: null,
  completedAt: null, pickupConfirmedAt: null, pickupConfirmedBy: null, locale: "fi", status: "NEW", archived: false, archivedAt: null, archivedBy: null,
  version: 1, createdAt: "2026-08-20T10:00:00.000Z", updatedAt: "2026-08-20T10:00:00.000Z",
};

const orders: AdminOrder[] = [
  baseOrder,
  { ...baseOrder, id: "story-order-1047", publicReference: "M-1047", idempotencyKey: "story-key-1047", customerName: "Mika Salonen", fulfillmentMethod: "DELIVERY", status: "PICKING", orderSource: "PHONE", finalTotalCents: 7250, itemSubtotalCents: 7250, version: 2 },
  { ...baseOrder, id: "story-order-1046", publicReference: "M-1046", idempotencyKey: "story-key-1046", customerName: "Laura Niemi", fulfillmentDate: "2026-08-21", status: "READY", finalTotalCents: 3100, itemSubtotalCents: 3100 },
  { ...baseOrder, id: "story-order-1045", publicReference: "M-1045", idempotencyKey: "story-key-1045", customerName: "Oskari Laine", fulfillmentDate: "2026-08-19", fulfillmentMethod: "DELIVERY", status: "DELIVERED", finalTotalCents: 9600, itemSubtotalCents: 9600 },
];

function OrdersStory({ empty = false, view = "TODAY" as OrdersView }: { empty?: boolean; view?: OrdersView }) {
  return <OrdersListing initialOrders={empty ? [] : orders} initialView={view} initialStatus="ALL" canExport={false} canCreate={false} canTransition={false} canUpdate={false} canDelete={false} canArchive={false} />;
}

const meta = { title: "Admin / Orders", component: OrdersStory, parameters: { layout: "fullscreen" }, argTypes: { empty: { control: "boolean" }, view: { control: "select", options: ["TODAY", "TRIAGE", "ALL", "ARCHIVED"] } } } satisfies Meta<typeof OrdersStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Queue: Story = { args: { empty: false, view: "TODAY" } };
export const Triage: Story = { args: { empty: false, view: "TRIAGE" } };
export const Empty: Story = { args: { empty: true, view: "TODAY" } };
