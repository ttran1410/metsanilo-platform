"use client";

import { useEffect, useId, useRef, useState, type ElementType, type ReactNode } from "react";
import Link from "next/link";

/** Small, domain-neutral building blocks shared by Operations workspaces. */
export function AdminCard({ as: Component = "section", children, className = "" }: { as?: ElementType; children: ReactNode; className?: string }) {
  return <Component className={`card admin-card ${className}`.trim()}>{children}</Component>;
}

const STATUS_TONES: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  CONFIRMED: "success", READY: "success", DELIVERED: "success", PICKED_UP: "success", PAID: "success",
  NEW: "warning", PENDING_FEE: "warning", CONFLICT_REVIEW: "warning", CAPACITY_NEAR_LIMIT: "warning",
  CANCELLED: "danger", REJECTED: "danger", NO_SHOW: "danger", CUSTOMER_DECLINED: "danger", REFUNDED: "danger", DELIVERY_ORIGIN_MISSING: "danger",
  PICKING: "info", OUT_FOR_DELIVERY: "info", UNPAID: "warning", PARTIALLY_REFUNDED: "warning",
};

export function AdminStatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONES[status] ?? "neutral";
  return <span className={`status-pill ops-status-${tone}`} aria-label={`Status: ${label ?? status}`}>{label ?? status.replaceAll("_", " ")}</span>;
}

export function AdminFieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return <p className="admin-field-error" id={id} role="alert" aria-live="polite">{message}</p>;
}

export function AdminPermissionGate({ allowed, children, fallback = null }: { allowed: boolean; children: ReactNode; fallback?: ReactNode }) {
  return allowed ? children : fallback;
}

export function formatAdminMoney(cents: number | null | undefined, currency = "EUR") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fi-FI", { style: "currency", currency }).format(cents / 100);
}

export function formatAdminReference(value: string) {
  return <span className="ops-tabular">{value}</span>;
}

export function AdminDataTable({ children, caption, className = "" }: { children: ReactNode; caption?: string; className?: string }) {
  return <div className={`admin-data-table-wrap ${className}`.trim()}>{caption && <p className="sr-only">{caption}</p>}<table className="admin-data-table">{children}</table></div>;
}

export function AdminRecordCard({ children, selected = false, className = "" }: { children: ReactNode; selected?: boolean; className?: string }) {
  return <article className={`admin-record-card${selected ? " is-selected" : ""} ${className}`.trim()}>{children}</article>;
}

export function AdminFilterBar({ children, onClear, clearLabel = "Clear filters" }: { children: ReactNode; onClear?: () => void; clearLabel?: string }) {
  return <div className="admin-filter-bar admin-filter-bar-shared"><div className="admin-filter-fields">{children}</div>{onClear && <button className="btn btn-secondary" type="button" onClick={onClear}>{clearLabel}</button>}</div>;
}

export function AdminSelectionToolbar({ count, total, children }: { count: number; total?: number; children?: ReactNode }) {
  return <div className={`admin-selection-toolbar card${count > 0 ? " is-active" : ""}`} role="region" aria-label="Selected records actions"><strong>{count} selected{total != null ? ` of ${total}` : ""}</strong>{count > 0 && children}</div>;
}

export function AdminConfirmDialog({ open, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", eyebrow = "Confirm action", destructive = false, onCancel, onConfirm, children }: { open: boolean; title: string; description?: string; confirmLabel?: string; cancelLabel?: string; eyebrow?: string; destructive?: boolean; onCancel: () => void; onConfirm: () => void | Promise<void>; children?: ReactNode }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])") ?? []).filter((element) => !element.hasAttribute("disabled"));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); onCancel(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [open, busy, onCancel]);
  async function handleConfirm() {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  }
  if (!open) return null;
  return <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}><section ref={dialogRef} className="admin-dialog card" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}><p className="eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}{children}<div className="profile-actions"><button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button><button className={`btn${destructive ? " btn-danger" : ""}`} type="button" onClick={() => void handleConfirm()} disabled={busy}>{busy ? "Saving…" : confirmLabel}</button></div></section></div>;
}

export function AdminTimeline({ events, emptyLabel = "No activity recorded." }: { events: Array<{ id: string; title: string; actor?: string; at: string; detail?: string }>; emptyLabel?: string }) {
  if (!events.length) return <p className="admin-timeline-empty">{emptyLabel}</p>;
  return <ol className="admin-timeline" aria-label="Activity timeline">{events.map((event) => <li key={event.id}><span className="admin-timeline-dot" aria-hidden="true" /><div><strong>{event.title}</strong>{event.detail && <p>{event.detail}</p>}<small>{event.actor ? `${event.actor} · ` : ""}<time dateTime={event.at}>{new Date(event.at).toLocaleString("fi-FI")}</time></small></div></li>)}</ol>;
}

export function AdminFeedback({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "error" | "warning" }) {
  return <div className={`admin-feedback admin-feedback-${tone}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">{children}</div>;
}

export function AdminNotFoundState({
  title = "Resource not found",
  description = "The requested item does not exist or may have been deleted.",
  backHref = "/admin",
  backLabel = "← Return to dashboard",
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="shell py-12">
      <div className="admin-state-panel admin-state-panel-centered">
        <span className="admin-state-icon" aria-hidden="true">?</span>
        <div>
          <p className="eyebrow">ADMIN OPERATIONS</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <Link href={backHref} className="btn btn-secondary">{backLabel}</Link>
      </div>
    </main>
  );
}
