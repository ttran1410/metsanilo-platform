"use client";

import { useMemo, useState, type FormEvent } from "react";

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
  onClose,
  onApplied,
}: {
  initialStartDate: string;
  initialEndDate: string;
  products: Array<{ id: string; nameFi: string }>;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [selectedProductId, setSelectedProductId] = useState<string>("ALL");
  const [capacityLitres, setCapacityLitres] = useState<number>(50);
  const [preset, setPreset] = useState<"ALL" | "WEEKDAYS" | "WEEKENDS" | "CUSTOM">("WEEKDAYS");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const targetDates = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return [];
    const dates: string[] = [];
    for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
      const day = new Date(`${cursor}T12:00:00Z`).getUTCDay();
      let include = false;
      if (preset === "ALL") include = true;
      else if (preset === "WEEKDAYS") include = day >= 1 && day <= 5;
      else if (preset === "WEEKENDS") include = day === 0 || day === 6;
      else if (preset === "CUSTOM") include = selectedWeekdays.includes(day);

      if (include) dates.push(cursor);
    }
    return dates;
  }, [startDate, endDate, preset, selectedWeekdays]);

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
            capacityLitres,
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "Batch capacity planning failed");
      }

      setSuccessMsg(`Successfully planned capacity for ${targetDates.length} date(s) (${totalCalculatedLitres} Total Liters).`);
      setTimeout(() => {
        onApplied();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch planning error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5 border-2 border-primary/30 bg-primary/5 rounded-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">BATCH CAPACITY SCHEDULER</span>
          <h3 className="text-base font-bold text-ink">⚡ In-Page Batch Harvest Planner</h3>
        </div>
        <button
          type="button"
          className="btn btn-secondary text-xs font-bold py-1 px-3"
          onClick={onClose}
        >
          ✕ Close Batch Panel
        </button>
      </div>

      {error && <div className="p-3 text-xs font-bold rounded-xl bg-rose-100 text-rose-900 border border-rose-300">⚠️ {error}</div>}
      {successMsg && <div className="p-3 text-xs font-bold rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300">✅ {successMsg}</div>}

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        {/* Quick Presets Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink/70">Quick Presets:</span>
          {[
            { key: "WEEKDAYS", label: "💼 Mon–Fri Weekdays" },
            { key: "WEEKENDS", label: "🫐 Weekend Harvest (Sat–Sun)" },
            { key: "ALL", label: "⚡ All Days" },
            { key: "CUSTOM", label: "⚙️ Custom Days" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                preset === item.key
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-surface text-ink/80 border-line hover:border-slate-400"
              }`}
              onClick={() => setPreset(item.key as any)}
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
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="text-xs"
            />
          </label>

          <label className="field">
            <span className="font-semibold text-xs text-ink">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="text-xs"
            />
          </label>

          <label className="field">
            <span className="font-semibold text-xs text-ink">Target Product</span>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
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
              onChange={(e) => setCapacityLitres(Math.max(1, Number(e.target.value)))}
              required
              className="text-xs font-bold"
            />
          </label>
        </div>

        {/* Live Preview Strip */}
        <div className="p-3 rounded-xl border border-line bg-surface flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-ink">
              📋 Target Dates ({targetDates.length} days selected)
            </span>
            <span className="font-bold text-primary">
              Total Calculated: {totalCalculatedLitres.toLocaleString("fi-FI")} L
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

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" className="btn btn-secondary text-xs font-semibold" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={loading || !targetDates.length} className="btn text-xs font-bold shadow-xs">
            {loading ? "⏳ Applying Batch Capacity..." : `🚀 Apply ${capacityLitres}L Capacity to ${targetDates.length} Date(s)`}
          </button>
        </div>
      </form>
    </div>
  );
}
