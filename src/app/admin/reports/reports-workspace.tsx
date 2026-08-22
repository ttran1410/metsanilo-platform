"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, RefreshCw, SlidersHorizontal } from "lucide-react";
import { AdminEmptyState, AdminLoadingState, AdminPageHeader } from "../presentation";

type ReportKey = "sales" | "capacity" | "payments" | "customers";
type ReportData = {
  meta: { from: string; to: string; timezone: string; generatedAt: string; formulaVersion: string };
  sales: { fulfilledOrders: number; fulfilledLitresMl: number; fulfilledSalesCents: number; averageOrderValueCents: number; deliveryFeeCents: number; cancelledOrders: number; timeline: Array<{ date: string; orders: number; litres: number; salesCents: number; deliveryCents: number }>; productMix: Array<{ label: string; orders: number; litres: number }>; methodMix: Array<{ method: string; orders: number; litres: number }>; sourceMix: Array<{ source: string; orders: number; litres: number }> };
  capacity: { configuredMl: number; reservedMl: number; remainingMl: number; utilizationPercent: number; rows: Array<{ date: string; productId: string; configuredMl: number; reservedMl: number; remainingMl: number; manualSoldOut: boolean }> };
  payments: { recordedPaymentsCents: number; refundsCents: number; netCashCents: number; paymentCount: number; refundCount: number };
  customers: { fulfilledCustomers: number; repeatCustomers: number; repeatRatePercent: number; unlinkedOrders: number };
  comparison: { from: string; to: string; fulfilledSalesCents: number; fulfilledLitresMl: number; fulfilledOrders: number; capacityUtilizationPercent: number };
};

const tabs: Array<{ key: ReportKey; label: string; eyebrow: string }> = [
  { key: "sales", label: "Sales & fulfilment", eyebrow: "WHAT LEFT THE SHED" },
  { key: "capacity", label: "Capacity & demand", eyebrow: "WHAT THE WEEK CAN HOLD" },
  { key: "payments", label: "Payments & refunds", eyebrow: "WHAT CASH MOVED" },
  { key: "customers", label: "Customer health", eyebrow: "WHO CAME BACK" },
];

function money(cents: number) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100); }
function litres(ml: number) { return `${(ml / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} L`; }

export function ReportsWorkspace({ permissions }: { permissions: Record<ReportKey, boolean> }) {
  const first = tabs.find((tab) => permissions[tab.key])?.key ?? "capacity";
  const [report, setReport] = useState<ReportKey>(first);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [productId, setProductId] = useState("");
  const [method, setMethod] = useState("");
  const [source, setSource] = useState("");
  const [products, setProducts] = useState<Array<{ id: string; nameEn: string }>>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => { const params = new URLSearchParams({ from, to, groupBy }); if (productId) params.set("productId", productId); if (method) params.set("method", method); if (source) params.set("source", source); return params.toString(); }, [from, to, groupBy, productId, method, source]);
  useEffect(() => {
    void fetch("/api/admin/products", { cache: "no-store" }).then((response) => response.json()).then((body) => setProducts((body.data ?? []).map((row: { product?: { id: string; nameEn: string }; id?: string; nameEn?: string }) => ({ id: row.product?.id ?? row.id ?? "", nameEn: row.product?.nameEn ?? row.nameEn ?? "Unnamed product" })).filter((product: { id: string }) => product.id))).catch(() => undefined);
  }, []);
  async function load() {
    setLoading(true); setError("");
    try { const response = await fetch(`/api/admin/reports/${report}?${query}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.message ?? "Report unavailable"); setData(body.data); } catch (err) { setError(err instanceof Error ? err.message : "Report unavailable"); } finally { setLoading(false); }
  }
  useEffect(() => {
    if (!permissions[report]) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [report, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = tabs.find((tab) => tab.key === report)!;
  return <main className="shell admin-report-shell">
    <AdminPageHeader eyebrow={active.eyebrow} title="Reports, with the operational story intact." description="A period ledger for fulfilled litres, demand pressure, cash events, and customer return. Draft and unapproved finance records are not part of this v1 view." meta={<span className="admin-report-asof">Europe/Helsinki · EUR · reporting-v1</span>} actions={<button className="btn btn-secondary" type="button" onClick={() => void load()} disabled={loading}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>} />
    <section className="admin-report-filterbar" aria-label="Report filters">
      <div className="admin-report-filter-title"><SlidersHorizontal className="w-4 h-4" /><span>Period</span></div>
      <label><span>From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label><span>To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <label><span>Group by</span><select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
      <label><span>Product</span><select value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">All products</option>{products.map((product, index) => <option key={`${product.id}-${index}`} value={product.id}>{product.nameEn}</option>)}</select></label>
      <label><span>Fulfilment</span><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="">All methods</option><option value="PICKUP">Pickup</option><option value="DELIVERY">Delivery</option></select></label>
      <label><span>Source</span><select value={source} onChange={(e) => setSource(e.target.value)}><option value="">All sources</option><option value="WEBSITE">Website</option><option value="WHATSAPP">WhatsApp</option><option value="MESSENGER">Messenger</option><option value="SMS">SMS</option><option value="PHONE">Phone</option><option value="OTHER">Other</option></select></label>
      <span className="admin-report-filter-note">Every number follows the applied period.</span>
    </section>
    <nav className="admin-report-tabs" aria-label="Reports">{tabs.filter((tab) => permissions[tab.key]).map((tab) => <button key={tab.key} type="button" className={report === tab.key ? "is-active" : ""} onClick={() => setReport(tab.key)}>{tab.label}</button>)}</nav>
    {loading ? <AdminLoadingState label="Assembling the period ledger…" /> : error ? <AdminEmptyState title={error} description="Try a shorter period or refresh the report." /> : data ? <ReportContent report={report} data={data} from={from} to={to} /> : null}
  </main>;
}

function ReportContent({ report, data, from, to }: { report: ReportKey; data: ReportData; from: string; to: string }) {
  const download = () => { const link = document.createElement("a"); link.href = `/api/admin/reports/${report}?from=${from}&to=${to}&format=csv`; link.download = `metsanilo-${report}-${from}-${to}.csv`; document.body.appendChild(link); link.click(); link.remove(); };
  return <section className="admin-report-content">
    <div className="admin-report-toolbar"><span>Data as of {new Date(data.meta.generatedAt).toLocaleString("en-GB")}</span><button className="btn btn-secondary" type="button" onClick={download}><Download className="w-3.5 h-3.5" /> CSV export</button></div>
    {report === "sales" && <><MetricLedger items={[["Fulfilled litres", litres(data.sales.fulfilledLitresMl), delta(data.sales.fulfilledLitresMl, data.comparison.fulfilledLitresMl)], ["Fulfilled sales", money(data.sales.fulfilledSalesCents), delta(data.sales.fulfilledSalesCents, data.comparison.fulfilledSalesCents)], ["Fulfilled orders", String(data.sales.fulfilledOrders), delta(data.sales.fulfilledOrders, data.comparison.fulfilledOrders)], ["Average order value", money(data.sales.averageOrderValueCents)]]} /><div className="admin-report-grid"><Panel title="Fulfilment over time"><Bars rows={data.sales.timeline.map((row) => ({ label: row.date.slice(5), value: row.litres / 1000, suffix: " L" }))} /></Panel><Panel title="Mix at a glance"><Mix rows={data.sales.methodMix.map((row) => ({ label: row.method === "PICKUP" ? "Pickup" : "Delivery", value: row.litres / 1000 }))} /></Panel></div><Panel title="Order source"><Mix rows={data.sales.sourceMix.map((row) => ({ label: row.source, value: row.orders, suffix: " orders" }))} /></Panel></>}
    {report === "capacity" && <><MetricLedger items={[["Configured", litres(data.capacity.configuredMl)], ["Reserved", litres(data.capacity.reservedMl)], ["Remaining", litres(data.capacity.remainingMl)], ["Utilisation", `${data.capacity.utilizationPercent}%`, delta(data.capacity.utilizationPercent, data.comparison.capacityUtilizationPercent, "pp")]]} /><Panel title="Harvest ribbon"><div className="admin-capacity-ribbon">{data.capacity.rows.slice(0, 31).map((row) => <div className="admin-capacity-lane" key={`${row.date}-${row.productId}`} title={`${row.date}: ${litres(row.reservedMl)} reserved of ${litres(row.configuredMl)}`}><span>{row.date.slice(5)}</span><i style={{ width: `${row.configuredMl ? Math.min(100, (row.reservedMl / row.configuredMl) * 100) : 0}%` }} /><small>{row.manualSoldOut ? "manual sold-out" : litres(row.remainingMl)}</small></div>)}</div></Panel><Panel title="Capacity facts"><div className="admin-report-table"><div className="admin-report-table-row admin-report-table-head"><span>Date</span><span>Configured</span><span>Reserved</span><span>Remaining</span></div>{data.capacity.rows.slice(0, 50).map((row) => <div className="admin-report-table-row" key={`${row.date}-${row.productId}`}><span>{row.date}</span><span>{litres(row.configuredMl)}</span><span>{litres(row.reservedMl)}</span><span>{litres(row.remainingMl)}{row.manualSoldOut && <em> · manual sold-out</em>}</span></div>)}</div></Panel></>}
    {report === "payments" && <><MetricLedger items={[["Payments recorded", money(data.payments.recordedPaymentsCents)], ["Refunds recorded", money(data.payments.refundsCents)], ["Net cash events", money(data.payments.netCashCents)], ["Refund count", String(data.payments.refundCount)]]} /><Panel title="Interpretation"><p className="admin-report-copy">Payments are cash events, not fulfilment recognition. Refunds remain visible here and do not reduce the fulfilled-sales metric.</p></Panel></>}
    {report === "customers" && <><MetricLedger items={[["Fulfilled customers", String(data.customers.fulfilledCustomers)], ["Repeat customers", String(data.customers.repeatCustomers)], ["Repeat rate", `${data.customers.repeatRatePercent}%`], ["Unlinked orders", String(data.customers.unlinkedOrders)]]} /><Panel title="Customer health"><p className="admin-report-copy">Repeat rate uses fulfilled orders only. Unlinked identities are excluded from the denominator and reported separately for data-quality context.</p></Panel></>}
  </section>;
}

function delta(current: number, previous: number, suffix = "") { if (!previous) return "No prior-period baseline"; const change = Math.round(((current - previous) / Math.abs(previous)) * 100); return `${change >= 0 ? "+" : ""}${change}%${suffix ? ` ${suffix}` : ""}`; }
function MetricLedger({ items }: { items: string[][] }) { return <div className="admin-report-ledger">{items.map(([label, value, comparison]) => <div key={label}><span>{label}</span><strong>{value}</strong>{comparison && <small className="admin-report-comparison">{comparison} vs previous period</small>}</div>)}</div>; }
function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="admin-report-panel"><div className="admin-report-panel-heading"><h2>{title}</h2><span>v1 read model</span></div>{children}</section>; }
function Bars({ rows }: { rows: Array<{ label: string; value: number; suffix?: string }> }) { const max = Math.max(1, ...rows.map((row) => row.value)); return <div className="admin-report-bars">{rows.map((row) => <div key={row.label}><div className="admin-report-bar-value">{row.value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}{row.suffix}</div><i style={{ height: `${Math.max(8, (row.value / max) * 100)}%` }} /><span>{row.label}</span></div>)}</div>; }
function Mix({ rows }: { rows: Array<{ label: string; value: number; suffix?: string }> }) { const max = Math.max(1, ...rows.map((row) => row.value)); return <div className="admin-report-mix">{rows.map((row) => <div key={row.label}><div><span>{row.label}</span><strong>{row.value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}{row.suffix ?? " L"}</strong></div><b><i style={{ width: `${(row.value / max) * 100}%` }} /></b></div>)}</div>; }
