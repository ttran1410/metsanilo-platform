"use client";

import Link from "next/link";
import type { FormattedAuditItem } from "@/domain/audit";
import { IconCopy } from "../ui/admin-row-action-menu";

export function DiffInspectorDrawer({
  item,
  onClose,
}: {
  item: FormattedAuditItem;
  onClose: () => void;
}) {
  const { diff, severity, category } = item;

  return (
    <div
      className="admin-dialog-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside className="admin-dialog card max-w-2xl w-full p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl animate-in slide-in-from-right">
        {/* DRAWER HEADER */}
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  severity === "HIGH"
                    ? "bg-rose-100 text-rose-900 border-rose-300"
                    : severity === "MEDIUM"
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-surface-muted text-ink/80 border-line"
                }`}
              >
                {severity === "HIGH"
                  ? "🔴 High Risk Security Event"
                  : severity === "MEDIUM"
                  ? "🟡 Sensitive Financial Edit"
                  : "⚪ Standard Operational Log"}
              </span>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-muted border border-line text-ink">
                {category}
              </span>
            </div>

            <h2 className="text-xl font-bold text-ink mt-1.5 font-mono">{item.action}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs muted font-mono">ID: {item.id}</p>
              <button
                type="button"
                className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                onClick={() => {
                  void navigator.clipboard.writeText(item.id);
                  alert(`Copied Audit Event ID: ${item.id}`);
                }}
                title="Copy Audit Event ID"
              >
                <IconCopy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary text-xs px-2.5 py-1 font-bold"
            onClick={onClose}
          >
            ✕ Close
          </button>
        </div>

        {/* METADATA SNAPSHOT */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-surface-muted rounded-xl border border-line text-xs">
          <div>
            <span className="eyebrow text-[10px] muted">ACTOR</span>
            <strong className="block text-ink font-bold mt-0.5">{item.actorDisplayName ?? item.actor}</strong>
            {item.actorEmail && <span className="text-[11px] muted block">{item.actorEmail}</span>}
          </div>

          <div>
            <span className="eyebrow text-[10px] muted">TIMESTAMP</span>
            <span className="block font-mono text-ink font-semibold mt-0.5">{item.createdAt}</span>
          </div>

          <div>
            <span className="eyebrow text-[10px] muted">TARGET ENTITY</span>
            <span className="block font-mono text-primary font-bold mt-0.5">
              {item.entityType}: {item.entityId}
            </span>
          </div>
        </div>

        {/* AUDIT REASON / HUMAN SUMMARY */}
        {(diff.summary || diff.reason) && (
          <div className="card p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl flex flex-col gap-1">
            <span className="eyebrow text-[10px] text-amber-900 font-bold">📝 AUDIT SUMMARY &amp; REASON</span>
            <p className="text-xs text-ink font-medium leading-relaxed">{diff.summary}</p>
            {diff.reason && (
              <p className="text-xs italic text-amber-950 bg-amber-100/60 p-2 rounded-lg border border-amber-200 mt-1">
                &quot;{diff.reason}&quot;
              </p>
            )}
          </div>
        )}

        {/* VISUAL DIFF INSPECTOR */}
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-[10px] muted">🔍 BEFORE VS AFTER DATA DIFF</span>

          {diff.changes && diff.changes.length > 0 ? (
            <div className="border border-line rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted border-b border-line text-[10px] font-bold text-muted uppercase">
                    <th className="py-2 px-3">Field Name</th>
                    <th className="py-2 px-3 text-rose-800 bg-rose-50/50">Before (- Old Value)</th>
                    <th className="py-2 px-3 text-emerald-800 bg-emerald-50/50">After (+ New Value)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono text-[11px]">
                  {diff.changes.map((change, idx) => (
                    <tr key={idx} className="hover:bg-surface-muted/40">
                      <td className="py-2.5 px-3 font-bold text-ink">{change.field}</td>
                      <td className="py-2.5 px-3 bg-rose-50/40 text-rose-900 line-through">
                        {JSON.stringify(change.oldVal) ?? "null"}
                      </td>
                      <td className="py-2.5 px-3 bg-emerald-50/40 text-emerald-900 font-bold">
                        {JSON.stringify(change.newVal) ?? "null"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs muted italic p-3 bg-surface-muted rounded-xl border border-line">
              No state modification diff detected. Operational action logged.
            </p>
          )}
        </div>

        {/* RAW JSON PAYLOAD */}
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-[10px] muted">📜 RAW PAYLOAD JSON</span>
          <pre className="p-3 bg-zinc-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-48 leading-tight">
            {JSON.stringify(diff.rawPayload ?? item.detailsJson, null, 2)}
          </pre>
        </div>

        {/* ENTITY DEEP LINKING ACTIONS */}
        <div className="pt-3 border-t border-line flex flex-wrap items-center justify-end gap-2">
          {item.entityType.toLowerCase() === "order" && (
            <Link
              href={`/admin/orders/${item.entityId}`}
              className="btn btn-secondary text-xs py-1.5 px-3 font-bold text-primary border-primary/30 hover:bg-primary/5"
            >
              🔗 Open Affected Order #{item.entityId} ↗
            </Link>
          )}

          {item.entityType.toLowerCase() === "user" && (
            <Link
              href="/admin/users"
              className="btn btn-secondary text-xs py-1.5 px-3 font-bold text-purple-900 border-purple-300 hover:bg-purple-50"
            >
              👤 View User Roster Profile ↗
            </Link>
          )}

          {item.entityType.toLowerCase() === "customer" && (
            <Link
              href={`/admin/customers/${item.entityId}`}
              className="btn btn-secondary text-xs py-1.5 px-3 font-bold text-blue-900 border-blue-300 hover:bg-blue-50"
            >
              📇 View Customer CRM Record ↗
            </Link>
          )}

          <button
            type="button"
            className="btn text-xs font-bold py-1.5 px-4"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
}
