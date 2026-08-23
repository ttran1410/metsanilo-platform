"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarCheck, Check, X } from "lucide-react";

type PlanPreview = {
  productId: string;
  productName: string;
  entries: Array<{ date: string; operation: "CREATE" | "OVERWRITE"; currentCapacityMl: number | null; reservedMl: number; nextCapacityMl: number; version: number | null; canApply: boolean }>;
  summary: { creates: number; overwrites: number; blocked: number };
};

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

export function BatchPlannerPanel({
  initialStartDate,
  initialEndDate,
  products,
  initialProductId,
  seasonId,
  onClose,
  onApplied,
}: {
  initialStartDate: string;
  initialEndDate: string;
  products: Array<{ id: string; nameFi: string }>;
  initialProductId?: string;
  seasonId?: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId ?? "ALL");
  const [capacityLitres, setCapacityLitres] = useState<number>(50);
  const [preset, setPreset] = useState<"ALL" | "WEEKDAYS" | "WEEKENDS">("ALL");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [preview, setPreview] = useState<PlanPreview[] | null>(null);

  function invalidatePreview() {
    setPreview(null);
    setError("");
    setSuccessMsg("");
  }

  const targetDates = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return [];
    const dates: string[] = [];
    for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
      const day = new Date(`${cursor}T12:00:00Z`).getUTCDay();
      let include = false;
      if (preset === "ALL") include = true;
      else if (preset === "WEEKDAYS") include = day >= 1 && day <= 5;
      else if (preset === "WEEKENDS") include = day === 0 || day === 6;

      if (include) dates.push(cursor);
    }
    return dates;
  }, [startDate, endDate, preset]);

  const totalCalculatedLitres = useMemo(() => {
    const productCount = selectedProductId === "ALL" ? products.length : 1;
    return targetDates.length * capacityLitres * productCount;
  }, [targetDates.length, capacityLitres, selectedProductId, products.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!targetDates.length) return setError("No dates selected in date range.");
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const targetProducts = selectedProductId === "ALL" ? products.map((p) => p.id) : [selectedProductId];

      if (!preview) {
        const previews: PlanPreview[] = [];
        for (const prodId of targetProducts) {
          const response = await fetch("/api/admin/availability/plan", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ productId: prodId, startDate, endDate, frequency: preset === "ALL" ? "DAY" : "CUSTOM", dates: targetDates, capacityMl: Math.round(capacityLitres * 1000), seasonId, preview: true }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message ?? "Capacity preview failed");
          previews.push(body.data);
        }
        setPreview(previews);
        if (previews.some((item) => item.summary.blocked > 0)) setError("Some dates are blocked because the planned capacity is below volume already reserved.");
        return;
      }

      for (const prodId of targetProducts) {
        const response = await fetch("/api/admin/availability/plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productId: prodId,
            startDate,
            endDate,
            frequency: preset === "ALL" ? "DAY" : "CUSTOM",
            dates: targetDates,
            capacityMl: Math.round(capacityLitres * 1000),
            seasonId,
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "Batch capacity planning failed");
      }

      setSuccessMsg(`Capacity applied to ${targetDates.length} date(s).`);
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch planning error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card availability-batch-planner">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 pb-3">
        <div>
          <span className="eyebrow">Capacity planning</span>
          <h3 className="text-base font-bold text-ink">Plan multiple business dates</h3>
        </div>
        <button
          type="button"
          className="admin-icon-button"
          onClick={onClose}
          aria-label="Close batch planner"
        >
          <X aria-hidden="true" />
        </button>
      </div>

      {error && <div className="admin-notice is-error" role="alert">{error}</div>}
      {successMsg && <div className="admin-notice is-success" role="status">{successMsg}</div>}

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        {/* Quick Presets Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink/70">Days</span>
          {[
            { key: "WEEKDAYS", label: "Mon–Fri" },
            { key: "WEEKENDS", label: "Sat–Sun" },
            { key: "ALL", label: "All days" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                preset === item.key
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-surface text-ink/80 border-line hover:border-slate-400"
              }`}
               onClick={() => { setPreset(item.key as "ALL" | "WEEKDAYS" | "WEEKENDS"); invalidatePreview(); }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <label className="field">
            <span className="font-semibold text-xs text-ink">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); invalidatePreview(); }}
              required
              className="text-xs"
            />
          </label>

          <label className="field">
            <span className="font-semibold text-xs text-ink">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); invalidatePreview(); }}
              required
              className="text-xs"
            />
          </label>

          <label className="field">
            <span className="font-semibold text-xs text-ink">Target Product</span>
            <select
              value={selectedProductId}
              onChange={(e) => { setSelectedProductId(e.target.value); invalidatePreview(); }}
              className="text-xs font-bold"
            >
              <option value="ALL">All Active Products ({products.length})</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameFi}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="font-semibold text-xs text-ink">Daily Capacity (Liters)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={capacityLitres}
              onChange={(e) => { setCapacityLitres(Math.max(1, Number(e.target.value))); invalidatePreview(); }}
              required
              className="text-xs font-bold"
            />
          </label>
        </div>

        {/* Live Preview Strip */}
        <div className="p-3 rounded-xl border border-line bg-surface flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-ink">
              Target dates ({targetDates.length})
            </span>
            <span className="font-bold text-primary">
              Planned total: {totalCalculatedLitres.toLocaleString("fi-FI")} L
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto pt-1">
            {targetDates.map((date) => (
              <span
                key={date}
                className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-surface-muted text-ink border border-line"
              >
                {formatShortDate(date)}
              </span>
            ))}
            {!targetDates.length && <span className="text-xs muted italic">No dates match current date range and preset.</span>}
          </div>
        </div>

        {preview && <section className="availability-plan-preview" aria-label="Batch plan preview"><header><div><span className="eyebrow">Review before applying</span><h4>{preview.reduce((sum, item) => sum + item.summary.creates, 0)} new · {preview.reduce((sum, item) => sum + item.summary.overwrites, 0)} overwritten</h4></div><CalendarCheck aria-hidden="true" /></header><div>{preview.flatMap((item) => item.entries.map((entry) => <article className={entry.canApply ? "" : "is-blocked"} key={`${item.productId}-${entry.date}`}><div><strong>{item.productName}</strong><span>{entry.date} · {entry.operation === "CREATE" ? "New date" : `Overwrite version ${entry.version}`}</span></div><div><span>{entry.currentCapacityMl === null ? "No capacity" : `${entry.currentCapacityMl / 1000} L`} → <strong>{entry.nextCapacityMl / 1000} L</strong></span><small>{entry.reservedMl / 1000} L reserved</small></div></article>))}</div></section>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" className="btn btn-secondary text-xs font-semibold" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={loading || !targetDates.length || Boolean(preview?.some((item) => item.summary.blocked > 0))} className="btn text-xs font-bold shadow-xs">
            {loading ? "Working…" : preview ? <><Check aria-hidden="true" />Apply reviewed plan</> : <><CalendarCheck aria-hidden="true" />Preview plan</>}
          </button>
        </div>
      </form>
    </div>
  );
}
