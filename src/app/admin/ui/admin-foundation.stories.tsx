import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  AdminCard,
  AdminConfirmDialog,
  AdminDataTable,
  AdminEmptyState,
  AdminFeedback,
  AdminFieldError,
  AdminFilterBar,
  AdminLoadingState,
  AdminNotice,
  AdminPageHeader,
  AdminPermissionGate,
  AdminRecordCard,
  AdminSelectionToolbar,
  AdminStatusBadge,
  AdminTimeline,
} from "../presentation";

function FoundationGallery({ dialog = false }: { dialog?: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(dialog);
  return (
    <main className="admin-foundation-story">
      <AdminPageHeader
        eyebrow="Shared foundation"
        title="A quiet system for busy work"
        description="The same surfaces, states, and status language should carry from the order queue to the settings desk."
        meta={<span className="admin-story-meta">Phase 1 · review fixture</span>}
        actions={<button className="btn" type="button" onClick={() => setDialogOpen(true)}>Open confirmation</button>}
      />

      <section className="admin-story-grid" aria-label="Foundation components">
        <AdminCard className="admin-story-card admin-story-card-wide">
          <div className="admin-story-card-heading"><div><p className="eyebrow">Feedback states</p><h2>Make the next action obvious</h2></div><AdminStatusBadge status="CAPACITY_NEAR_LIMIT" /></div>
          <div className="admin-story-stack"><AdminNotice tone="neutral">Neutral context stays quiet and readable.</AdminNotice><AdminNotice tone="success" live>Capacity plan saved.</AdminNotice><AdminNotice tone="warning" live>Two orders need an address check.</AdminNotice><AdminNotice tone="error" live>Could not save the capacity plan.</AdminNotice></div>
        </AdminCard>

        <AdminCard className="admin-story-card">
          <div className="admin-story-card-heading"><div><p className="eyebrow">Status language</p><h2>Text first, color second</h2></div></div>
          <div className="admin-story-statuses"><AdminStatusBadge status="NEW" /><AdminStatusBadge status="CONFIRMED" /><AdminStatusBadge status="PICKING" /><AdminStatusBadge status="UNPAID" /><AdminStatusBadge status="DELIVERED" /><AdminStatusBadge status="CANCELLED" /></div>
        </AdminCard>

        <AdminCard className="admin-story-card">
          <div className="admin-story-card-heading"><div><p className="eyebrow">Queue controls</p><h2>Filter, then act</h2></div></div>
          <AdminFilterBar onClear={() => undefined}><label className="admin-story-field"><span>Queue</span><select defaultValue="today"><option value="today">Today</option><option value="week">Next 7 days</option></select></label><label className="admin-story-field"><span>Search</span><input placeholder="Order reference" /></label></AdminFilterBar>
          <AdminSelectionToolbar count={2} total={18}><button className="btn btn-secondary" type="button">Confirm selected</button></AdminSelectionToolbar>
        </AdminCard>

        <AdminCard className="admin-story-card admin-story-card-wide">
          <div className="admin-story-card-heading"><div><p className="eyebrow">Records and feedback</p><h2>One meaning across table and card</h2></div></div>
          <AdminDataTable caption="Example order records"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Value</th></tr></thead><tbody><tr><td><strong className="ops-tabular">MN-1042</strong></td><td>Liisa Korhonen</td><td><AdminStatusBadge status="CONFIRMED" /></td><td className="ops-tabular">€42.00</td></tr><tr><td><strong className="ops-tabular">MN-1043</strong></td><td>Oskari Niemi</td><td><AdminStatusBadge status="UNPAID" /></td><td className="ops-tabular">€68.00</td></tr></tbody></AdminDataTable>
          <div className="admin-story-records"><AdminRecordCard selected><strong>MN-1042</strong><span>Liisa Korhonen · Confirmed</span><AdminStatusBadge status="CONFIRMED" /></AdminRecordCard><AdminRecordCard><strong>MN-1043</strong><span>Oskari Niemi · Payment due</span><AdminStatusBadge status="UNPAID" /></AdminRecordCard></div>
        </AdminCard>

        <AdminCard className="admin-story-card">
          <div className="admin-story-card-heading"><div><p className="eyebrow">System states</p><h2>Nothing disappears silently</h2></div></div>
          <div className="admin-story-stack"><AdminLoadingState label="Loading today’s queue…" /><AdminEmptyState title="No orders match these filters" description="Clear a filter or try another reference." /><AdminFieldError id="story-error" message="Choose a pickup date before continuing." /><AdminFeedback tone="error">The selected order is out of date. Refresh before saving.</AdminFeedback></div>
        </AdminCard>

        <AdminCard className="admin-story-card">
          <div className="admin-story-card-heading"><div><p className="eyebrow">Permission and audit</p><h2>Trust the record</h2></div></div>
          <AdminPermissionGate allowed={false} fallback={<AdminFeedback tone="warning">You can view this queue, but you cannot change its status.</AdminFeedback>}><button className="btn" type="button">Hidden action</button></AdminPermissionGate>
          <AdminTimeline events={[{ id: "1", title: "Order confirmed", actor: "Tuan Huynh", at: "2026-08-20T09:42:00+03:00", detail: "Customer notified by WhatsApp." }]} />
        </AdminCard>
      </section>

      <AdminConfirmDialog open={dialogOpen} title="Freeze tomorrow’s capacity?" description="This is a review-only confirmation surface. The real module supplies the mutation and reason fields." confirmLabel="Freeze capacity" onCancel={() => setDialogOpen(false)} onConfirm={() => setDialogOpen(false)} />
    </main>
  );
}

const meta = { title: "Admin / Foundation", component: FoundationGallery, parameters: { layout: "fullscreen" } } satisfies Meta<typeof FoundationGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Gallery: Story = { args: { dialog: false } };
export const ConfirmationOpen: Story = { args: { dialog: true } };
