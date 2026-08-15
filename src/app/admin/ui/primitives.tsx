import type { ElementType, ReactNode } from "react";

/** Small, domain-neutral building blocks shared by Operations workspaces. */
export function AdminCard({ as: Component = "section", children, className = "" }: { as?: ElementType; children: ReactNode; className?: string }) {
  return <Component className={`card admin-card ${className}`.trim()}>{children}</Component>;
}

const STATUS_TONES: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  CONFIRMED: "success", READY: "success", DELIVERED: "success", PICKED_UP: "success", PAID: "success",
  NEW: "warning", PENDING_FEE: "warning", CONFLICT_REVIEW: "warning", CAPACITY_NEAR_LIMIT: "warning",
  CANCELLED: "danger", REJECTED: "danger", NO_SHOW: "danger", CUSTOMER_DECLINED: "danger", REFUNDED: "danger", DELIVERY_ORIGIN_MISSING: "danger",
  PICKING: "neutral", OUT_FOR_DELIVERY: "neutral", UNPAID: "neutral", PARTIALLY_REFUNDED: "neutral",
};

export function AdminStatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONES[status] ?? "neutral";
  return <span className={`status-pill ops-status-${tone}`} aria-label={`Status: ${label ?? status}`}>{label ?? status.replaceAll("_", " ")}</span>;
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
