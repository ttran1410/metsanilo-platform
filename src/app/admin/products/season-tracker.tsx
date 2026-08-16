"use client";

import { useState } from "react";
import { AdminStatusBadge } from "../presentation";

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
  availableFrom,
  availableThrough,
  active,
  onUpdateDates,
}: {
  availableFrom: string;
  availableThrough: string;
  active: boolean;
  onUpdateDates?: (from: string, through: string) => void;
}) {
  const today = todayStr();

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
    <div className="card p-4 flex flex-col gap-3 bg-surface-muted/50 border border-line rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider muted">HARVEST SEASON TIMELINE</span>
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

        {onUpdateDates && (
          <button
            type="button"
            className="btn btn-secondary text-xs py-1 px-2.5"
            onClick={() => onUpdateDates(availableFrom, addDays(availableThrough, 7))}
          >
            ＋ Extend Season +1 Week
          </button>
        )}
      </div>

      {/* Visual Timeline Progress Bar */}
      <div className="flex flex-col gap-1.5 pt-1">
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
    </div>
  );
}
