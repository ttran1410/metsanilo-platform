import type { ReactNode } from "react";

export function AdminPageHeader({ eyebrow, title, description, meta, actions }: { eyebrow?: string; title: string; description?: string; meta?: ReactNode; actions?: ReactNode }) {
  return <div className="admin-page-header"><div><p className="eyebrow">{eyebrow ?? "METSÄNILO OPERATIONS"}</p><h1>{title}</h1>{description && <p className="admin-page-lede">{description}</p>}</div>{(meta || actions) && <div className="admin-page-meta">{meta}{actions && <div className="admin-page-actions">{actions}</div>}</div>}</div>;
}

export function AdminNotice({ children, tone = "neutral", live = false }: { children: ReactNode; tone?: "neutral" | "error" | "success"; live?: boolean }) {
  return <div className={`admin-notice admin-notice-${tone}`} role={live ? "status" : tone === "error" ? "alert" : undefined}>{children}</div>;
}

export function AdminLoadingState({ label = "Loading…" }: { label?: string }) {
  return <div className="admin-state-card" role="status"><span className="admin-state-spinner" aria-hidden="true" />{label}</div>;
}

export function AdminEmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="admin-state-card"><strong>{title}</strong>{description && <span>{description}</span>}</div>;
}

export function AdminPermissionState() {
  return <main className="shell py-10"><AdminNotice tone="error">You do not have permission to access this area.</AdminNotice></main>;
}
