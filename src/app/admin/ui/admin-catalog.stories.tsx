import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ProductModule } from "../products";
import { AdminEmptyState, AdminNotice, AdminPageHeader } from "../presentation";
import type { packages, products } from "@/db/schema";

const product: typeof products.$inferSelect = { id: "story-product", shopId: "story-shop", code: "BERRY-01", slug: "metsamustikka", nameFi: "Metsamustikka", nameEn: "Wild blueberry", descriptionFi: "Fresh local berries.", descriptionEn: "Fresh local berries.", availableFrom: "2026-07-01", availableThrough: "2026-09-30", active: true, showOnHomepage: true, showOnReserve: true, sortOrder: 0 };
const productPackage: typeof packages.$inferSelect = { id: "story-package", shopId: "story-shop", productId: product.id, labelFi: "1 litra", labelEn: "1 litre", volumeMl: 1000, priceCents: 4800, active: true, sortOrder: 0, isDefault: true };
const initialProducts = [{ product, packages: [productPackage], media: [{ id: "story-media", url: "/metsanilo-leaf.svg", altFi: "Metsamustikka", altEn: "Wild blueberry", isPrimary: true }] }];

function CatalogStory({ canManageProducts = true }: { canManageProducts?: boolean }) {
  return <ProductModule initialProducts={initialProducts} canManageProducts={canManageProducts} />;
}

const meta = { title: "Admin / Catalog", component: CatalogStory, parameters: { layout: "fullscreen" }, argTypes: { canManageProducts: { control: "boolean" } } } satisfies Meta<typeof CatalogStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MasterDetail: Story = { args: { canManageProducts: true } };
export const ReadOnly: Story = { args: { canManageProducts: false } };

function ProductWorkflowDemo({ state }: { state: "readiness" | "pricing" | "archive" | "conflict" }) {
  const [archived, setArchived] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const visible = query ? initialProducts.filter((item) => item.product.nameFi.toLowerCase().includes(query.toLowerCase())) : initialProducts;
  return <main className="admin-page-shell p-6"><AdminPageHeader eyebrow="CATALOG & PRICING" title="Products" description="Product readiness, package pricing, archive impact, and season workflows." />
    {notice && <AdminNotice tone={state === "conflict" ? "warning" : "success"} live>{notice}</AdminNotice>}
    <label className="field mt-4 max-w-sm"><span>Search products</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search catalog" /></label>
    {!visible.length ? <AdminEmptyState title="No products found" description="Clear the search to return to the catalog." /> : visible.map((item) => <section key={item.product.id} className="card mt-4 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between"><div><h2 className="font-bold">{item.product.nameFi}</h2><p className="text-xs muted">{item.product.availableFrom} – {item.product.availableThrough}</p></div><span className={`badge ${archived ? "badge-muted" : "badge-success"}`}>{archived ? "ARCHIVED" : "READY"}</span></div>
      {state === "readiness" && <div className="text-xs">Readiness checks: bilingual data ✓ · default package ✓ · harvest season ⚠ · capacity ⚠</div>}
      {state === "pricing" && <div className="text-xs">Package price: <strong>€48.00 / litre</strong> · Season overrides: not enabled</div>}
      {state === "archive" && <><div className="text-xs">Impact preview: 4 historical orders retain snapshots; 12 availability rows will stop accepting orders.</div><button type="button" className="btn w-fit" onClick={() => { setArchived(true); setNotice("Product archived. Historical orders remain discoverable."); }}>Archive product</button></>}
      {state === "conflict" && <><div className="text-xs">Another operator changed this product while you were editing.</div><button type="button" className="btn w-fit" onClick={() => setNotice("Latest product state loaded.")}>Reload latest</button></>}
    </section>)}</main>;
}

function SeasonWorkflowDemo() {
  const [cloned, setCloned] = useState(false);
  return <main className="admin-page-shell p-6"><AdminPageHeader eyebrow="HARVEST HISTORY" title="Product seasons" description="Discoverable historical seasons with clone and capacity workflows." /><section className="card mt-4 p-4"><div className="flex items-center justify-between"><div><h2 className="font-bold">Summer 2026 Harvest{cloned ? " copy" : ""}</h2><p className="text-xs muted">2026-07-01 – 2026-08-31 · 240 L planned · 18 orders</p></div><span className="badge badge-success">ACTIVE</span></div><div className="flex gap-2 mt-4"><button type="button" className="btn" onClick={() => setCloned(true)}>Clone season</button><button type="button" className="btn btn-secondary">Open capacity</button></div>{cloned && <AdminNotice tone="success" live>Season cloned. Review dates before publishing capacity.</AdminNotice>}</section></main>;
}

export const Readiness: Story = { render: () => <ProductWorkflowDemo state="readiness" /> };
export const Pricing: Story = { render: () => <ProductWorkflowDemo state="pricing" /> };
export const ArchiveImpact: Story = { render: () => <ProductWorkflowDemo state="archive" /> };
export const MutationConflict: Story = { render: () => <ProductWorkflowDemo state="conflict" /> };
export const SeasonWorkflow: Story = { render: () => <SeasonWorkflowDemo /> };
