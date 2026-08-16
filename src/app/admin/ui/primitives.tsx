import type { ElementType, ReactNode } from "react";
import { useAdminI18n } from "../i18n-context";

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
  const { t } = useAdminI18n();
  const tone = STATUS_TONES[status] ?? "neutral";
  const displayLabel = label ?? t(`status.${status}`, status.replaceAll("_", " "));
  return <span className={`status-pill ops-status-${tone}`} aria-label={`Status: ${displayLabel}`}>{displayLabel}</span>;
}

export function AdminFieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return <p className="admin-field-error" id={id} role="alert">{message}</p>;
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

export function AdminConfirmDialog({ open, title, description, confirmLabel = "Confirm", destructive = false, onCancel, onConfirm, children }: { open: boolean; title: string; description?: string; confirmLabel?: string; destructive?: boolean; onCancel: () => void; onConfirm: () => void; children?: ReactNode }) {
  if (!open) return null;
  return <div className="admin-dialog-backdrop"><section className="admin-dialog card" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title"><p className="eyebrow">Confirm action</p><h2 id="admin-dialog-title">{title}</h2>{description && <p>{description}</p>}{children}<div className="profile-actions"><button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button><button className={`btn${destructive ? " btn-danger" : ""}`} type="button" onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

export function AdminTimeline({ events, emptyLabel = "No activity recorded." }: { events: Array<{ id: string; title: string; actor?: string; at: string; detail?: string }>; emptyLabel?: string }) {
  if (!events.length) return <p className="admin-timeline-empty">{emptyLabel}</p>;
  return <ol className="admin-timeline" aria-label="Activity timeline">{events.map((event) => <li key={event.id}><span className="admin-timeline-dot" aria-hidden="true" /><div><strong>{event.title}</strong>{event.detail && <p>{event.detail}</p>}<small>{event.actor ? `${event.actor} · ` : ""}<time dateTime={event.at}>{new Date(event.at).toLocaleString("fi-FI")}</time></small></div></li>)}</ol>;
}

export function AdminFeedback({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "error" | "warning" }) {
  return <div className={`admin-feedback admin-feedback-${tone}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">{children}</div>;
}
