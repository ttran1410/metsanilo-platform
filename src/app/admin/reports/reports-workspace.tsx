"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarRange, Download, ExternalLink, RefreshCw, SlidersHorizontal } from "lucide-react";
import { AdminEmptyState, AdminLoadingState, AdminNotice, AdminPageHeader } from "../presentation";
import { getAdminQuery } from "../admin-query-cache";

type ReportKey = "sales" | "capacity" | "payments" | "customers";
type ReportData = {
  meta: { from: string; to: string; groupBy: string; timezone: string; generatedAt: string; formulaVersion: string };
  sales: { fulfilledOrders: number; fulfilledLitresMl: number; fulfilledSalesCents: number; averageOrderValueCents: number; deliveryFeeCents: number; cancelledOrders: number; timeline: Array<{ date: string; orders: number; litres: number; salesCents: number; deliveryCents: number }>; productMix: Array<{ label: string; orders: number; litres: number }>; methodMix: Array<{ method: string; orders: number; litres: number }>; sourceMix: Array<{ source: string; orders: number; litres: number }> };
  capacity: { configuredMl: number; reservedMl: number; remainingMl: number; utilizationPercent: number; rows: Array<{ date: string; productId: string; configuredMl: number; reservedMl: number; remainingMl: number; manualSoldOut: boolean }> };
  payments: { recordedPaymentsCents: number; refundsCents: number; netCashCents: number; paymentCount: number; refundCount: number; events: Array<{ id: string; orderId: string; orderReference: string; kind: string; method: string; amountCents: number; recordedAt: string }> };
  customers: { fulfilledCustomers: number; repeatCustomers: number; repeatRatePercent: number; unlinkedOrders: number; groups: Array<{ key: string; orders: number; litres: number; salesCents: number }> };
  comparison: { from: string; to: string; fulfilledSalesCents: number; fulfilledLitresMl: number; fulfilledOrders: number; capacityUtilizationPercent: number };
};

const tabs: Array<{ key: ReportKey; label: string }> = [
  { key: "sales", label: "Sales and fulfilment" },
  { key: "capacity", label: "Capacity and demand" },
  { key: "payments", label: "Payments and refunds" },
  { key: "customers", label: "Customer health" },
];

const dateBasis: Record<ReportKey, string> = {
  sales: "Fulfilment date · picked-up and delivered orders only",
  capacity: "Availability business date · configured and reserved capacity",
  payments: "Order fulfilment date · payment events attached to matching orders",
  customers: "Fulfilment date · linked picked-up and delivered orders",
};

function todayInFinland() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" }).format(new Date());
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function money(cents: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function litres(ml: number) {
  return `${(ml / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} L`;
}

export function ReportsWorkspace({ permissions }: { permissions: Record<ReportKey, boolean> }) {
  const allowedTabs = tabs.filter((tab) => permissions[tab.key]);
  const [report, setReport] = useState<ReportKey>(allowedTabs[0]?.key ?? "sales");
  const today = todayInFinland();
  const [from, setFrom] = useState(() => addDays(todayInFinland(), -6));
  const [to, setTo] = useState(() => todayInFinland());
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [productId, setProductId] = useState("");
  const [method, setMethod] = useState("");
  const [source, setSource] = useState("");
  const [products, setProducts] = useState<Array<{ id: string; nameEn: string }>>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const invalidRange = from > to;

  const query = useMemo(() => {
    const params = new URLSearchParams({ from, to, groupBy });
    if (productId) params.set("productId", productId);
    if (method) params.set("method", method);
    if (source) params.set("source", source);
    return params.toString();
  }, [from, groupBy, method, productId, source, to]);

  useEffect(() => {
    void getAdminQuery<Array<{ product?: { id: string; nameEn: string }; id?: string; nameEn?: string }>>("/api/admin/products", "admin-products-options")
      .then((rows) => setProducts((rows ?? []).map((row) => ({ id: row.product?.id ?? row.id ?? "", nameEn: row.product?.nameEn ?? row.nameEn ?? "Unnamed product" })).filter((product) => product.id)))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    if (!permissions[report]) return;
    if (invalidRange) {
      setLoading(false);
      setError("Start date must be on or before end date.");
      return;
    }
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/reports/${report}?${query}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Report unavailable");
      if (currentRequest === requestId.current) setData(body.data);
    } catch (caught) {
      if (currentRequest === requestId.current) setError(caught instanceof Error ? caught.message : "Report unavailable");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [invalidRange, permissions, query, report]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectedProduct = products.find((product) => product.id === productId)?.nameEn;
  const relevantFilters = [
    `${from}–${to}`,
    report === "sales" ? `Grouped by ${groupBy}` : null,
    selectedProduct ?? (productId ? "Selected product" : "All products"),
    report !== "capacity" ? (method || "All fulfilment methods") : null,
    report !== "capacity" ? (source || "All sources") : null,
  ].filter(Boolean).join(" · ");

  function applyPreset(days: number) {
    setTo(today);
    setFrom(addDays(today, -(days - 1)));
  }

  if (!allowedTabs.length) {
    return <main className="shell admin-report-shell"><AdminPageHeader eyebrow="Operations insight" title="Reports" description="Period-based operational reporting." /><AdminEmptyState title="No report access" description="Ask an administrator for access to at least one reporting lens." /></main>;
  }

  return <main className="shell admin-report-shell">
    <AdminPageHeader eyebrow="Operations insight" title="Reports" description="Choose a period, then inspect fulfilment, capacity, cash events, or customer return using the same applied filters." meta={<span className="admin-report-asof">Europe/Helsinki · EUR · reporting-v1</span>} actions={<button className="btn btn-secondary" type="button" onClick={() => void load()} disabled={loading || invalidRange}><RefreshCw aria-hidden="true" />{loading ? "Refreshing…" : "Refresh"}</button>} />

    <section className="admin-report-filterbar" aria-label="Report filters">
      <div className="admin-report-filter-title"><SlidersHorizontal aria-hidden="true" /><span>Period</span></div>
      <div className="admin-report-presets" aria-label="Period presets"><button type="button" onClick={() => applyPreset(7)}>7 days</button><button type="button" onClick={() => applyPreset(30)}>30 days</button><button type="button" onClick={() => { setFrom(`${today.slice(0, 4)}-06-01`); setTo(today); }}>Season</button></div>
      <label><span>From</span><input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
      <label><span>To</span><input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
      {report === "sales" && <label><span>Group by</span><select value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>}
      <label><span>Product</span><select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">All products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.nameEn}</option>)}</select></label>
      {report !== "capacity" && <label><span>Fulfilment</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option value="">All methods</option><option value="PICKUP">Pickup</option><option value="DELIVERY">Delivery</option></select></label>}
      {report !== "capacity" && <label><span>Source</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="">All sources</option><option value="WEBSITE">Website</option><option value="WHATSAPP">WhatsApp</option><option value="MESSENGER">Messenger</option><option value="SMS">SMS</option><option value="PHONE">Phone</option><option value="OTHER">Other</option></select></label>}
      <div className="admin-report-applied"><CalendarRange aria-hidden="true" /><span><strong>Applied instantly</strong>{relevantFilters}</span></div>
    </section>

    {invalidRange && <AdminNotice tone="error" live>Start date must be on or before end date.</AdminNotice>}

    <nav className="admin-report-tabs" role="tablist" aria-label="Report lenses">{allowedTabs.map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={report === tab.key} className={report === tab.key ? "is-active" : ""} onClick={() => setReport(tab.key)}>{tab.label}</button>)}</nav>
    {loading ? <AdminLoadingState label="Assembling the period report…" /> : error ? <AdminEmptyState title="Report unavailable" description={error} /> : data ? <ReportContent report={report} data={data} query={query} filterSummary={relevantFilters} /> : null}
  </main>;
}

function ReportContent({ report, data, query, filterSummary }: { report: ReportKey; data: ReportData; query: string; filterSummary: string }) {
  const ordersHref = `/admin/orders?view=ALL&preset=CUSTOM&from=${data.meta.from}&to=${data.meta.to}`;
  return <section className="admin-report-content">
    <div className="admin-report-toolbar"><div><strong>Applied result</strong><span>{filterSummary}</span><small>{dateBasis[report]} · Refreshed {new Date(data.meta.generatedAt).toLocaleString("en-GB", { timeZone: data.meta.timezone })}</small></div><a className="btn btn-secondary" href={`/api/admin/reports/${report}?${query}&format=csv`} download={`metsanilo-${report}-${data.meta.from}-${data.meta.to}.csv`}><Download aria-hidden="true" />Export filtered CSV</a></div>

    {report === "sales" && <><MetricLedger items={[{ label: "Fulfilled litres", value: litres(data.sales.fulfilledLitresMl), comparison: delta(data.sales.fulfilledLitresMl, data.comparison.fulfilledLitresMl), href: ordersHref }, { label: "Fulfilled sales", value: money(data.sales.fulfilledSalesCents), comparison: delta(data.sales.fulfilledSalesCents, data.comparison.fulfilledSalesCents), href: ordersHref }, { label: "Fulfilled orders", value: String(data.sales.fulfilledOrders), comparison: delta(data.sales.fulfilledOrders, data.comparison.fulfilledOrders), href: ordersHref }, { label: "Average order value", value: money(data.sales.averageOrderValueCents), href: ordersHref }]} /><div className="admin-report-grid"><Panel title="Fulfilment over time"><Bars rows={data.sales.timeline.map((row) => ({ label: row.date, value: row.litres / 1000, suffix: " L" }))} empty="No fulfilled orders in this period." /></Panel><Panel title="Fulfilment mix"><Mix rows={data.sales.methodMix.map((row) => ({ label: row.method === "PICKUP" ? "Pickup" : "Delivery", value: row.litres / 1000 }))} empty="No fulfilled pickup or delivery volume." /></Panel></div><Panel title="Order source"><Mix rows={data.sales.sourceMix.map((row) => ({ label: row.source, value: row.orders, suffix: " orders" }))} empty="No fulfilled order sources in this period." /></Panel></>}

    {report === "capacity" && <><MetricLedger items={[{ label: "Configured", value: litres(data.capacity.configuredMl), href: "/admin/availability" }, { label: "Reserved", value: litres(data.capacity.reservedMl), href: "/admin/availability" }, { label: "Remaining", value: litres(data.capacity.remainingMl), href: "/admin/availability" }, { label: "Utilisation", value: `${data.capacity.utilizationPercent}%`, comparison: pointDelta(data.capacity.utilizationPercent, data.comparison.capacityUtilizationPercent), href: "/admin/availability" }]} /><Panel title="Capacity by business date">{data.capacity.rows.length ? <div className="admin-capacity-ribbon">{data.capacity.rows.slice(0, 31).map((row) => <div className="admin-capacity-lane" key={`${row.date}-${row.productId}`} title={`${row.date}: ${litres(row.reservedMl)} reserved of ${litres(row.configuredMl)}`}><span>{row.date.slice(5)}</span><i style={{ width: `${row.configuredMl ? Math.min(100, (row.reservedMl / row.configuredMl) * 100) : 0}%` }} /><small>{row.manualSoldOut ? "Manual sold-out" : `${litres(row.remainingMl)} left`}</small></div>)}</div> : <ReportEmpty>No capacity rows in this period.</ReportEmpty>}</Panel><Panel title="Capacity records"><ReportTable headers={["Date", "Configured", "Reserved", "Remaining"]} rows={data.capacity.rows.slice(0, 50).map((row) => [row.date, litres(row.configuredMl), litres(row.reservedMl), `${litres(row.remainingMl)}${row.manualSoldOut ? " · manual sold-out" : ""}`])} empty="No capacity records match these filters." /></Panel></>}

    {report === "payments" && <><MetricLedger items={[{ label: "Payments recorded", value: money(data.payments.recordedPaymentsCents) }, { label: "Refunds recorded", value: money(data.payments.refundsCents) }, { label: "Net cash events", value: money(data.payments.netCashCents) }, { label: "Refund count", value: String(data.payments.refundCount) }]} /><Panel title="Payment event drill-down"><ReportTable headers={["Recorded", "Order", "Kind", "Method", "Amount"]} rows={data.payments.events.map((event) => [new Date(event.recordedAt).toLocaleDateString("en-GB"), <Link key={event.id} href={`/admin/orders/${event.orderId}`}>{event.orderReference}<ExternalLink aria-hidden="true" /></Link>, event.kind, event.method, money(event.amountCents)])} empty="No payment or refund events are attached to orders in this period." /></Panel><Panel title="Recognition basis"><p className="admin-report-copy">Payments are cash events attached to orders whose fulfilment date matches the period. Refunds remain visible and do not reduce fulfilled-sales metrics.</p></Panel></>}

    {report === "customers" && <><MetricLedger items={[{ label: "Fulfilled customers", value: String(data.customers.fulfilledCustomers), href: "/admin/customers" }, { label: "Repeat in period", value: String(data.customers.repeatCustomers), href: "/admin/customers" }, { label: "Repeat rate", value: `${data.customers.repeatRatePercent}%`, href: "/admin/customers" }, { label: "Unlinked orders", value: String(data.customers.unlinkedOrders), href: ordersHref }]} /><Panel title="Customer drill-down"><ReportTable headers={["Customer", "Fulfilled orders", "Volume", "Value"]} rows={data.customers.groups.map((group) => [group.key === "unlinked" ? "Unlinked identity" : <Link key={group.key} href={`/admin/customers?customer=${group.key}`}>Customer {group.key.slice(0, 8)}<ExternalLink aria-hidden="true" /></Link>, String(group.orders), litres(group.litres), money(group.salesCents)])} empty="No fulfilled customer activity in this period." /></Panel><Panel title="Recognition basis"><p className="admin-report-copy">Repeat rate means more than one fulfilled order within this selected period. Unlinked identities are excluded from fulfilled-customer counts and shown separately.</p></Panel></>}
  </section>;
}

function delta(current: number, previous: number) {
  if (!previous) return "No prior-period baseline";
  const change = Math.round(((current - previous) / Math.abs(previous)) * 100);
  return `${change >= 0 ? "+" : ""}${change}%`;
}

function pointDelta(current: number, previous: number) {
  const change = Math.round((current - previous) * 10) / 10;
  return `${change >= 0 ? "+" : ""}${change} pp`;
}

type MetricItem = { label: string; value: string; comparison?: string; href?: string };
function MetricLedger({ items }: { items: MetricItem[] }) {
  return <div className="admin-report-ledger">{items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.comparison && <small className="admin-report-comparison">{item.comparison} vs previous period</small>}{item.href && <Link href={item.href}>Open records<ExternalLink aria-hidden="true" /></Link>}</div>)}</div>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="admin-report-panel"><div className="admin-report-panel-heading"><h2>{title}</h2><span>Applied period</span></div>{children}</section>;
}

function ReportEmpty({ children }: { children: ReactNode }) {
  return <div className="admin-report-empty">{children}</div>;
}

function Bars({ rows, empty }: { rows: Array<{ label: string; value: number; suffix?: string }>; empty: string }) {
  if (!rows.length || rows.every((row) => row.value === 0)) return <ReportEmpty>{empty}</ReportEmpty>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <div className="admin-report-bars">{rows.map((row) => <div key={row.label}><div className="admin-report-bar-value">{row.value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}{row.suffix}</div><i style={{ height: `${Math.max(8, (row.value / max) * 100)}%` }} /><span>{row.label}</span></div>)}</div>;
}

function Mix({ rows, empty }: { rows: Array<{ label: string; value: number; suffix?: string }>; empty: string }) {
  if (!rows.length || rows.every((row) => row.value === 0)) return <ReportEmpty>{empty}</ReportEmpty>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <div className="admin-report-mix">{rows.map((row) => <div key={row.label}><div><span>{row.label}</span><strong>{row.value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}{row.suffix ?? " L"}</strong></div><b><i style={{ width: `${(row.value / max) * 100}%` }} /></b></div>)}</div>;
}

function ReportTable({ headers, rows, empty }: { headers: string[]; rows: ReactNode[][]; empty: string }) {
  if (!rows.length) return <ReportEmpty>{empty}</ReportEmpty>;
  return <div className="admin-report-table"><div className="admin-report-table-row admin-report-table-head">{headers.map((header) => <span key={header}>{header}</span>)}</div>{rows.map((row, rowIndex) => <div className="admin-report-table-row" key={rowIndex}>{row.map((cell, cellIndex) => <span key={cellIndex} data-label={headers[cellIndex]}>{cell}</span>)}</div>)}</div>;
}
