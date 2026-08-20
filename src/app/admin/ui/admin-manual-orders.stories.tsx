import type { Meta, StoryObj } from "@storybook/react";
import { ManualOrdersModule } from "../manual-orders";
import { AdminEmptyState, AdminNotice, AdminPageHeader } from "../presentation";

const products = [
  {
    product: { id: "story-product", nameFi: "Metsamustikka" },
    packages: [
      { id: "story-package-1", labelFi: "1 litra", volumeMl: 1000, priceCents: 4800 },
      { id: "story-package-5", labelFi: "5 litraa", volumeMl: 5000, priceCents: 22000 },
    ],
  },
];

const meta = {
  title: "Admin / Manual Orders",
  component: ManualOrdersModule,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ManualOrdersModule>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewOrder: Story = { args: { products } };
export const HistoricalOrder: Story = {
  args: { products },
  play: async ({ canvas }) => {
    await canvas.getByRole("button", { name: /historical record/i }).click();
  },
};

function ManualOrderStateDemo({ state }: { state: "loading" | "error" | "empty" | "permission" }) {
  if (state === "loading") return <main className="shell py-10"><div className="card p-8 text-sm muted" role="status">Loading order intake...</div></main>;
  if (state === "error") return <main className="shell py-10"><AdminNotice tone="error" live>Order sources could not be loaded. The form can be retried without losing the draft.</AdminNotice></main>;
  if (state === "empty") return <main className="shell py-10"><AdminPageHeader eyebrow="ORDER INTAKE" title="Create manual order" description="Choose an active product before starting order intake." /><AdminEmptyState title="No products available" description="Activate a product before creating a manual order." /></main>;
  return <main className="shell py-10"><AdminNotice tone="error" live>You do not have permission to create manual orders.</AdminNotice></main>;
}

export const Loading: Story = { args: { products }, render: () => <ManualOrderStateDemo state="loading" /> };
export const Error: Story = { args: { products }, render: () => <ManualOrderStateDemo state="error" /> };
export const EmptyCatalog: Story = { args: { products }, render: () => <ManualOrderStateDemo state="empty" /> };
export const PermissionLimited: Story = { args: { products }, render: () => <ManualOrderStateDemo state="permission" /> };
