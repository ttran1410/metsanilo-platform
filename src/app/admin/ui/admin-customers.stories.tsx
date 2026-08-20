import type { Meta, StoryObj } from "@storybook/react";
import { MasterDetailCustomerWorkspace } from "../customers/master-detail-workspace";

const initialCustomers = [{
  id: "story-customer", name: "Aino Korhonen", mobile: "+358 40 123 4567", email: "aino@example.com", matchStatus: "MATCHED", marketingConsent: true, marketingConsentStatus: "GRANTED", marketingConsentAt: "2026-08-01T10:00:00.000Z", marketingConsentSource: "PUBLIC_FORM", marketingConsentUpdatedBy: null, notes: "Prefers pickup.", facebookProfile: null, updatedAt: "2026-08-20T10:00:00.000Z", metrics: { totalOrders: 12, completedOrders: 11, noShowCount: 0, reliabilityRatePercent: 100, lifetimeLitres: 48, totalSpendCents: 31200, lastFulfillmentDate: "2026-08-20", isVip: true, preferredMethod: "PICKUP" as const, reviewCount: 3, averageRating: 4.8, primaryAddress: "Pori" },
}];

function CustomersStory({ canEdit = true, canAnonymize = true }: { canEdit?: boolean; canAnonymize?: boolean }) {
  return <MasterDetailCustomerWorkspace initialCustomers={initialCustomers} canEdit={canEdit} canAnonymize={canAnonymize} />;
}

const meta = { title: "Admin / Customers", component: CustomersStory, parameters: { layout: "fullscreen" }, argTypes: { canEdit: { control: "boolean" }, canAnonymize: { control: "boolean" } } } satisfies Meta<typeof CustomersStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Customer360: Story = { args: { canEdit: true, canAnonymize: true } };
export const ReadOnly: Story = { args: { canEdit: false, canAnonymize: false } };
