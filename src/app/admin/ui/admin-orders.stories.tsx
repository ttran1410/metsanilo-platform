import type { Meta, StoryObj } from "@storybook/react";

type OrderState = "New" | "Picking" | "Ready" | "Delivered";
const orders: Array<{ reference: string; customer: string; fulfilment: string; method: string; state: OrderState; total: string }> = [
  { reference: "M-1048", customer: "Aino Korhonen", fulfilment: "Today, 14:30", method: "Pickup", state: "New", total: "48.00 EUR" },
  { reference: "M-1047", customer: "Mika Salonen", fulfilment: "Today, 15:00", method: "Delivery", state: "Picking", total: "72.50 EUR" },
  { reference: "M-1046", customer: "Laura Niemi", fulfilment: "Tomorrow, 09:00", method: "Pickup", state: "Ready", total: "31.00 EUR" },
  { reference: "M-1045", customer: "Oskari Laine", fulfilment: "Yesterday", method: "Delivery", state: "Delivered", total: "96.00 EUR" },
];

function OrdersPreview({ empty = false, selected = false }: { empty?: boolean; selected?: boolean }) {
  return <main className="admin-orders-workspace shell pb-10"><div className="admin-orders-header flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3"><div><p className="eyebrow">Operations workspace</p><h1>Orders &amp; fulfilment</h1><p className="admin-section-description">One queue for the next operational decision.</p></div><div className="profile-actions"><button className="btn btn-secondary" type="button">Export CSV</button><button className="btn" type="button">New order</button></div></div><div className="admin-quick-views flex flex-wrap gap-2"><button className="btn" type="button">All <span className="quick-view-count">24</span></button><button className="btn btn-secondary" type="button">Needs attention <span className="quick-view-count">3</span></button><button className="btn btn-secondary" type="button">Today <span className="quick-view-count">8</span></button></div>{selected && <div className="admin-selection-toolbar card p-3 flex items-center justify-between"><strong>2 orders selected</strong><button className="btn btn-secondary" type="button">Batch confirm</button></div>}<div className="card p-3 flex flex-wrap gap-3"><input className="flex-1 min-w-[16rem]" aria-label="Search orders" placeholder="Reference, customer or phone" /><select aria-label="Filter status"><option>All statuses</option><option>New</option></select><select aria-label="Filter fulfilment"><option>Pickup &amp; delivery</option><option>Pickup</option></select></div>{empty ? <div className="admin-empty-state card p-8"><strong>No orders match these filters</strong><p>Try a wider date range or clear one of the filters.</p></div> : <div className="admin-orders-table-wrap card"><table className="admin-orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Fulfilment</th><th>Status</th><th>Total</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.reference}><td><strong>{order.reference}</strong><small>Placed 10 min ago</small></td><td><strong>{order.customer}</strong><small>+358 40 123 4567</small></td><td><strong>{order.fulfilment}</strong><small>{order.method}</small></td><td><span className="pill">{order.state}</span></td><td><strong>{order.total}</strong></td><td><button className="btn btn-secondary" type="button">View</button></td></tr>)}</tbody></table></div>}</main>;
}

const meta = { title: "Admin / Orders", component: OrdersPreview, parameters: { layout: "fullscreen" }, argTypes: { empty: { control: "boolean" }, selected: { control: "boolean" } } } satisfies Meta<typeof OrdersPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Queue: Story = { args: { empty: false, selected: false } };
export const BatchSelection: Story = { args: { empty: false, selected: true } };
export const Empty: Story = { args: { empty: true, selected: false } };
