"use client";

import { useEffect, useState } from "react";
import { Plus, Calendar, Trash2 } from "lucide-react";
import { SeasonWorkflowDialogs } from "./season-workflow-dialogs";
import { useSeasonMutationController } from "./use-season-mutation-controller";
import { useSeasonQueryController } from "./use-season-query-controller";

export type SeasonItem = {
  id: string;
  productId: string;
  nameFi: string;
  nameEn: string;
  startDate: string;
  endDate: string;
  status: "UPCOMING" | "ACTIVE" | "PAUSED" | "COMPLETED";
  targetVolumeMl?: number | null;
  notes?: string | null;
};

type SeasonSummary = {
  availabilityDays: number;
  plannedVolumeMl: number;
  reservedVolumeMl: number;
  remainingVolumeMl: number;
  orderCount: number;
  orderedVolumeMl: number;
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SeasonTracker({
  productId,
  availableFrom,
  availableThrough,
  active,
  onUpdateDates,
}: {
  productId?: string;
  availableFrom: string;
  availableThrough: string;
  active: boolean;
  onUpdateDates?: (from: string, through: string) => void;
}) {
  const today = todayStr();
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [deleteSeasonId, setDeleteSeasonId] = useState<string | null>(null);

  // New Season Form State
  const currentYear = new Date().getFullYear();
  const [nameEn, setNameEn] = useState(`Summer ${currentYear} Harvest`);
  const [nameFi, setNameFi] = useState(`Kesä ${currentYear} Satokausi`);
  const [startDate, setStartDate] = useState(`${currentYear}-07-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-08-31`);
  const [notes, setNotes] = useState("");
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(null);
  const [targetLitres, setTargetLitres] = useState("");

  useSeasonQueryController({ productId, selectedSeasonId, setSeasons, setSummary, setSummaryLoading });

  function selectSeason(seasonId: string) {
    const selected = seasons.find((season) => season.id === seasonId);
    setSelectedSeasonId((current) => (current === seasonId ? null : seasonId));
    setTargetLitres(selected?.targetVolumeMl ? String(selected.targetVolumeMl / 1000) : "");
    setSummary(null);
    setSummaryLoading(selectedSeasonId === seasonId ? false : true);
  }

  const seasonMutations = useSeasonMutationController({ productId, availableFrom, availableThrough, cloneSourceId, nameEn, nameFi, startDate, endDate, notes, targetLitres, onUpdateDates, setSeasons, setShowAddForm, setCloneSourceId, setDeleteSeasonId });
  const { busy, saveSeasonGoal, saveFallbackSeasonGoal, handleAddSeason, handleDeleteSeason, confirmDeleteSeason, handleExtendSeason } = seasonMutations;

  function prepareClone(season: SeasonItem) {
    setCloneSourceId(season.id);
    setNameEn(`${season.nameEn} copy`);
    setNameFi(`${season.nameFi} kopio`);
    setStartDate(season.startDate);
    setEndDate(season.endDate);
    setNotes(season.notes ?? "");
    setTargetLitres(season.targetVolumeMl ? String(season.targetVolumeMl / 1000) : "");
    setShowAddForm(true);
  }

  // Active or fallback single season calculation
  const startMs = new Date(`${availableFrom}T00:00:00Z`).getTime();
  const endMs = new Date(`${availableThrough}T00:00:00Z`).getTime();
  const todayMs = new Date(`${today}T00:00:00Z`).getTime();

  const totalDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.round((todayMs - startMs) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, Math.round((endMs - todayMs) / (1000 * 60 * 60 * 24)));

  const isPreSeason = today < availableFrom;
  const isPostSeason = today > availableThrough;
  const isInSeason = active && !isPreSeason && !isPostSeason;

  const progressPercent = isPreSeason
    ? 0
    : isPostSeason
    ? 100
    : Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

  return (
    <div className="card p-4 flex flex-col gap-4 bg-surface-muted/50 border border-line rounded-xl">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider muted">HARVEST SEASONS &amp; TIMELINE</span>
          <h4 className="text-sm font-bold text-ink flex items-center gap-2 mt-0.5">
            {isInSeason ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                🟢 Active Harvest Season ({remainingDays} days remaining)
              </span>
            ) : isPreSeason ? (
              <span className="text-amber-700 font-bold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                🟡 Pre-Season Pre-Orders (Starts in {Math.round((startMs - todayMs) / (1000 * 60 * 60 * 24))} days)
              </span>
            ) : (
              <span className="text-muted font-semibold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                ⚪ Harvest Season Ended ({availableThrough})
              </span>
            )}
          </h4>
        </div>

        <div className="flex items-center gap-2">
          {onUpdateDates && (
            <button
              type="button"
              className="btn btn-secondary text-xs py-1 px-2.5 font-bold"
              onClick={() => {
                const activeSeason = seasons.find((s) => s.status === "ACTIVE") ?? seasons[0];
                if (activeSeason) {
                  void handleExtendSeason(activeSeason);
                } else {
                  onUpdateDates(availableFrom, addDays(availableThrough, 7));
                }
              }}
              disabled={busy}
            >
              ＋ Extend +1 Week
            </button>
          )}

          {productId && (
            <button
              type="button"
              className="btn text-xs py-1 px-2.5 font-bold flex items-center gap-1"
              onClick={() => {
                setShowAddForm((prev) => !prev);
                setCloneSourceId(null);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? "Cancel" : "New Season"}</span>
            </button>
          )}
        </div>
      </div>

      {/* VISUAL TIMELINE PROGRESS BAR */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs muted font-medium ops-tabular">
          <span>Start: <strong>{availableFrom}</strong></span>
          {isInSeason && (
            <span className="text-primary font-bold">
              Day {elapsedDays + 1} of {totalDays}
            </span>
          )}
          <span>End: <strong>{availableThrough}</strong></span>
        </div>

        <div className="w-full h-3 rounded-full bg-line/60 overflow-hidden p-0.5 relative">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isInSeason ? "bg-emerald-600" : isPreSeason ? "bg-amber-500" : "bg-slate-400"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {productId && seasons.length === 0 && (
        <div className="p-3 bg-surface rounded-xl border border-amber-200 flex flex-wrap items-end justify-between gap-3 text-xs">
          <div><strong className="block text-ink">This availability window has no saved season record yet.</strong><span className="text-muted">Set a target below to save this current window as an editable harvest season.</span></div>
          <div className="flex items-end gap-2"><label className="field max-w-[14rem]"><span>Season fulfilled target (litres)</span><div className="relative"><input type="number" min="1" step="1" value={targetLitres} onChange={(event) => setTargetLitres(event.target.value)} placeholder="e.g. 240" /><span className="absolute right-2 top-2 text-muted">L</span></div></label><button type="button" className="btn btn-secondary text-xs" onClick={() => void saveFallbackSeasonGoal()} disabled={busy || !targetLitres}>Save current season</button></div>
        </div>
      )}

      {/* CREATE NEW SEASON FORM MODAL/DRAWER */}
      {showAddForm && (
        <form onSubmit={handleAddSeason} className="p-3 bg-surface rounded-xl border border-line flex flex-col gap-3 text-xs">
               <span className="eyebrow text-primary">{cloneSourceId ? "CLONE HARVEST SEASON" : "CREATE NEW HARVEST SEASON"}</span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="field">
              <span>Season Name (English)</span>
              <input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Summer 2026 Harvest"
                required
              />
            </label>

            <label className="field">
              <span>Season Name (Finnish)</span>
              <input
                value={nameFi}
                onChange={(e) => setNameFi(e.target.value)}
                placeholder="e.g. Kesä 2026 Satokausi"
                required
              />
            </label>

            <label className="field">
              <span>Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Season fulfilled target (litres)</span>
              <div className="relative"><input type="number" min="1" step="1" value={targetLitres} onChange={(e) => setTargetLitres(e.target.value)} placeholder="e.g. 240" /><span className="absolute right-2 top-2 text-muted">L</span></div>
              <small className="text-muted">How many litres do you aim to fulfil this season? This does not change daily capacity.</small>
            </label>
          </div>

          <label className="field">
            <span>Staff Crop Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Weather dry, high berry sweetness expected…"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => {
                setShowAddForm(false);
                setCloneSourceId(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn text-xs font-bold py-1.5 px-3" disabled={busy}>
              {busy ? "Saving…" : cloneSourceId ? "Clone Season" : "Save Season"}
            </button>
          </div>
        </form>
      )}

      {/* MULTI-SEASON HISTORY LIST */}
      {seasons.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-line/60">
          <span className="eyebrow text-[10px] muted">ALL HARVEST SEASONS ({seasons.length})</span>
          <span className="text-[11px] text-muted">Choose <strong>Edit target</strong> on a season to update its fulfilled-litre target.</span>

          <div className="space-y-2">
            {seasons.map((s) => {
              const sActive = s.startDate <= today && today <= s.endDate;
              return (
                <div
                  key={s.id}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("input, button")) return;
                    selectSeason(s.id);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectSeason(s.id);
                    }
                  }}
                  className={`p-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 transition-all ${
                    sActive
                      ? "bg-emerald-50/50 border-emerald-300"
                      : s.endDate < today
                      ? "bg-surface-muted/60 border-line text-muted"
                      : "bg-amber-50/40 border-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted shrink-0" />
                    <div>
                      <strong className="text-ink font-bold block">{s.nameEn} ({s.nameFi})</strong>
                      <span className="text-[11px] text-muted ops-tabular">
                        📅 {s.startDate} ➔ {s.endDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {sActive ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                        🟢 ACTIVE
                      </span>
                    ) : s.endDate < today ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                        ⚪ COMPLETED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        🟡 UPCOMING
                      </span>
                    )}

                    <button
                      type="button"
                      className="btn btn-secondary text-[11px] py-1 px-2 font-bold"
                      onClick={(event) => { event.stopPropagation(); selectSeason(s.id); }}
                    >
                      {selectedSeasonId === s.id ? "Close" : "Edit target"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary text-[11px] py-1 px-2 font-bold"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleExtendSeason(s);
                      }}
                      disabled={busy}
                      title="Extend this season by +1 week"
                    >
                      +1 Week
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary text-[11px] py-1 px-2 font-bold"
                      onClick={(event) => {
                        event.stopPropagation();
                        prepareClone(s);
                      }}
                      disabled={busy}
                    >
                      Clone
                    </button>

                    <button
                      type="button"
                      className="p-1 rounded text-rose-600 hover:bg-rose-100 transition-colors"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteSeason(s.id);
                      }}
                      disabled={busy}
                      title="Delete Season"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                      </div>

                  {selectedSeasonId === s.id && productId && (
                    <div className="basis-full flex flex-wrap items-end gap-2 border-t border-line/60 pt-2">
                      <label className="field text-[11px] max-w-[15rem]"><span>Season fulfilled target (litres)</span><div className="relative"><input type="number" min="1" step="1" value={targetLitres} onChange={(event) => setTargetLitres(event.target.value)} placeholder="No target" /><span className="absolute right-2 top-2 text-muted">L</span></div></label>
                      <button type="button" className="btn btn-secondary text-[11px] py-1.5 px-2.5" onClick={() => void saveSeasonGoal(s)} disabled={busy}>Save goal</button>
                    </div>
                  )}

                  {selectedSeasonId === s.id && (
                    <div className="basis-full grid grid-cols-2 sm:grid-cols-5 gap-2 border-t border-line/60 pt-2 text-[11px]" aria-live="polite">
                      {summaryLoading ? <span className="text-muted col-span-full">Loading season metrics…</span> : summary ? <>
                        <span><strong className="block text-ink ops-tabular">{summary.availabilityDays}</strong>planned days</span>
                        <span><strong className="block text-ink ops-tabular">{(summary.plannedVolumeMl / 1000).toFixed(1)} L</strong>planned</span>
                        <span><strong className="block text-ink ops-tabular">{(summary.reservedVolumeMl / 1000).toFixed(1)} L</strong>reserved</span>
                        <span><strong className="block text-ink ops-tabular">{(summary.remainingVolumeMl / 1000).toFixed(1)} L</strong>remaining</span>
                        <span><strong className="block text-ink ops-tabular">{summary.orderCount}</strong>orders</span>
                        {s.targetVolumeMl ? <span><strong className="block text-ink ops-tabular">{Math.min(100, Math.round((summary.orderedVolumeMl / s.targetVolumeMl) * 100))}%</strong>goal progress</span> : null}
                      </> : <span className="text-muted col-span-full">No season metrics available.</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <SeasonWorkflowDialogs open={deleteSeasonId !== null} onCancel={() => setDeleteSeasonId(null)} onConfirm={() => confirmDeleteSeason(deleteSeasonId)} />
    </div>
  );
}
