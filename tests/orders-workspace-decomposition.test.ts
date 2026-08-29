import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("Orders workspace decomposition contract", () => {
  it("renders each order through the focused record row component", () => {
    const workspace = source("src/app/admin/orders/list/orders-listing.tsx");
    expect(workspace).toContain('import { OrderRecordRow } from "../order-record-row";');
    expect(workspace).toContain("return <OrderRecordRow key={order.id}");
    expect(workspace).not.toContain("<tr key={order.id} className=\"hover:bg-surface-muted/40 transition-colors\">");
    expect(source("src/app/admin/orders-listing.tsx")).toContain('export { OrdersListing } from "./orders/list/orders-listing";');
  });

  it("keeps row presentation and actions inside the row component", () => {
    const row = source("src/app/admin/orders/order-record-row.tsx");
    expect(row).toContain("OrderRowSelectionCell");
    expect(row).toContain("OrderRowSummaryCells");
    expect(row).toContain("OrderRowStatusCell");
    expect(row).toContain("OrderRowActions");
    expect(row).toContain("onQuickTransition");
    expect(row).toContain("onDelete");
  });
});
