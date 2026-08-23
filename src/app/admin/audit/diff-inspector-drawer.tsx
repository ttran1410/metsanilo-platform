"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Fingerprint,
  Info,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import type { FormattedAuditItem } from "@/domain/audit";

export function DiffInspectorDrawer({
  item,
  onClose,
}: {
  item: FormattedAuditItem;
  onClose: () => void;
}) {
  const { diff, severity, category } = item;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function copyToClipboard(text: string, key: string) {
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopiedKey(null);
    }, 2200);
  }

  const rawJsonFormatted = JSON.stringify(diff.rawPayload ?? item.detailsJson, null, 2);

  return (
    <div
      className="admin-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        className="admin-dialog card max-w-2xl w-full p-5 sm:p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto shadow-2xl rounded-2xl animate-in slide-in-from-right focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-drawer-title"
      >
        {/* DRAWER HEADER */}
        <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border ${
                  severity === "HIGH"
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : severity === "MEDIUM"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                {severity === "HIGH" ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                ) : severity === "MEDIUM" ? (
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                )}
                {severity === "HIGH"
                  ? "High risk security event"
                  : severity === "MEDIUM"
                  ? "Sensitive financial edit"
                  : "Standard operational log"}
              </span>

              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-muted border border-line text-ink">
                {category}
              </span>
            </div>

            <h2 id="audit-drawer-title" className="text-xl font-bold text-ink tracking-tight font-mono break-all mt-1">
              {item.action}
            </h2>

            <div className="flex flex-wrap items-center gap-2 text-xs muted font-mono mt-0.5">
              <span>ID: {item.id}</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200 text-slate-600 hover:text-ink text-[11px] font-sans transition-colors cursor-pointer"
                onClick={() => copyToClipboard(item.id, "event-id")}
                aria-label="Copy event ID"
              >
                {copiedKey === "event-id" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>

              {item.correlationId && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-600">
                    <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                    Trace: {item.correlationId.slice(0, 12)}…
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200 text-slate-600 hover:text-ink text-[11px] font-sans transition-colors cursor-pointer"
                    onClick={() => copyToClipboard(item.correlationId!, "trace-id")}
                    aria-label="Copy correlation ID"
                  >
                    {copiedKey === "trace-id" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy trace</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            className="p-1.5 rounded-lg border border-line hover:bg-surface-muted text-ink transition-colors cursor-pointer shrink-0"
            onClick={onClose}
            aria-label="Close details drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* METADATA SNAPSHOT */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-surface-muted/60 rounded-xl border border-line text-xs">
          <div>
            <span className="eyebrow text-[10px] text-slate-500 font-bold">ACTOR</span>
            <strong className="block text-ink font-bold mt-1 truncate">
              {item.actorInfo?.name ?? item.actorDisplayName ?? item.actor}
            </strong>
            {(item.actorInfo?.subtitle || item.actorEmail) && (
              <span className="text-[11px] muted block truncate mt-0.5">
                {item.actorInfo?.subtitle ?? item.actorEmail}
              </span>
            )}
          </div>

          <div>
            <span className="eyebrow text-[10px] text-slate-500 font-bold">TIMESTAMP</span>
            <span className="block font-mono text-ink font-semibold mt-1">
              {new Date(item.createdAt).toLocaleString("fi-FI", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span className="text-[11px] muted block font-mono mt-0.5">{item.createdAt}</span>
          </div>

          <div>
            <span className="eyebrow text-[10px] text-slate-500 font-bold">TARGET ENTITY</span>
            <span className="block font-mono text-ink font-bold mt-1 truncate">
              {item.targetInfo?.label ?? `${item.entityType}: ${item.entityId}`}
            </span>
            {item.targetInfo?.href ? (
              <Link
                href={item.targetInfo.href}
                className="text-[11px] text-primary font-bold hover:underline inline-flex items-center gap-0.5 mt-0.5"
              >
                Open resource <ChevronRight className="w-3 h-3" />
              </Link>
            ) : (
              <span className="text-[11px] muted block font-mono mt-0.5">ID: {item.entityId}</span>
            )}
          </div>
        </div>

        {/* AUDIT SUMMARY & REASON */}
        {(diff.summary || diff.reason) && (
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex flex-col gap-1.5">
            <span className="eyebrow text-[10px] text-amber-900 font-bold flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              AUDIT SUMMARY &amp; REASON
            </span>
            <p className="text-xs text-ink font-medium leading-relaxed">{diff.summary}</p>
            {diff.reason && (
              <p className="text-xs italic text-amber-950 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200 mt-0.5">
                &ldquo;{diff.reason}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* VISUAL DIFF INSPECTOR */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-[10px] text-slate-500 font-bold">BEFORE VS AFTER DATA DIFF</span>
            {diff.changes && diff.changes.length > 0 && (
              <span className="text-[11px] muted font-mono">{diff.changes.length} field(s) modified</span>
            )}
          </div>

          {diff.changes && diff.changes.length > 0 ? (
            <div className="border border-line rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted border-b border-line text-[10px] font-bold text-muted uppercase">
                    <th className="py-2 px-3">Field</th>
                    <th className="py-2 px-3 text-rose-800 bg-rose-50/40">Before (− Old value)</th>
                    <th className="py-2 px-3 text-emerald-800 bg-emerald-50/40">After (+ New value)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono text-[11px]">
                  {diff.changes.map((change, idx) => (
                    <tr key={idx} className="hover:bg-surface-muted/30">
                      <td className="py-2.5 px-3 font-bold text-ink">{change.field}</td>
                      <td className="py-2.5 px-3 bg-rose-50/30 text-rose-900">
                        <span className="line-through">{JSON.stringify(change.oldVal) ?? "null"}</span>
                      </td>
                      <td className="py-2.5 px-3 bg-emerald-50/30 text-emerald-900 font-bold">
                        <span>{JSON.stringify(change.newVal) ?? "null"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs muted italic p-3 bg-surface-muted/60 rounded-xl border border-line">
              No state modification diff detected. Operational action logged.
            </p>
          )}
        </div>

        {/* RAW JSON PAYLOAD */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-[10px] text-slate-500 font-bold">RAW EVENT PAYLOAD</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-200 text-slate-600 hover:text-ink text-[11px] font-sans transition-colors cursor-pointer"
              onClick={() => copyToClipboard(rawJsonFormatted, "raw-json")}
            >
              {copiedKey === "raw-json" ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Payload copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-3 bg-zinc-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-44 leading-relaxed select-all">
            {rawJsonFormatted}
          </pre>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 mt-auto">
          <div className="flex items-center gap-2">
            {item.targetInfo?.href && (
              <Link
                href={item.targetInfo.href}
                className="btn btn-secondary text-xs py-1.5 px-3 font-semibold inline-flex items-center gap-1.5"
              >
                <span>Jump to {item.entityType}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <button
            type="button"
            className="btn text-xs font-semibold py-1.5 px-4"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
}
