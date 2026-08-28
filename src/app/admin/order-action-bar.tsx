"use client";

import { useState } from "react";
import { getFulfillmentActions, type OrderTransition } from "@/domain/order-transitions";
import { AdminConfirmDialog } from "./presentation";
import { useOrderStatusActionController } from "./use-order-status-action-controller";

type ActionOrder = { id: string; publicReference: string; status: string; fulfillmentMethod: string; finalTotalCents: number | null; version: number };

export function OrderActionBar({ order, onTransition, compact = false, confirmAll = false }: { order: ActionOrder; onTransition?: (status: string, reason?: string) => Promise<void> | void; compact?: boolean; confirmAll?: boolean }) {
  const [pending, setPending] = useState<OrderTransition | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const transitionOrder = useOrderStatusActionController({ onError: setError, onSuccess: () => window.location.reload() });
  const actions = getFulfillmentActions(order);
  const available = actions.filter((action) => action.available);
  const blocked = actions.filter((action) => !action.available);

  function choose(action: OrderTransition) {
    setReason("");
    if (confirmAll || action.requiresReason) return setPending(action);
    void execute(action.status);
  }

  async function execute(status: string, transitionReason?: string) {
    if (onTransition) return onTransition(status, transitionReason);
    await transitionOrder(order, status, transitionReason);
  }

  async function confirm() {
    if (!pending) return;
    if (pending.requiresReason && reason.trim().length < 2) return;
    await execute(pending.status, reason.trim() || undefined);
    setPending(null);
    setReason("");
  }

  return <>
    {error && <p className="admin-feedback admin-feedback-error" role="alert">{error}</p>}
    <div className={`order-action-bar${compact ? " is-compact" : ""}`} aria-label="Allowed order actions">
      {available.map((action) => <button className={action.requiresReason ? "btn btn-danger" : "btn"} key={action.status} type="button" onClick={() => choose(action)}>{action.label}</button>)}
      {available.length === 0 && <span className="order-action-bar-empty">No fulfillment actions available.</span>}
    </div>
    {blocked.map((action) => <p className="order-action-blocked" key={action.status}>{action.label} unavailable: {action.blockedReason}</p>)}
    <AdminConfirmDialog open={pending !== null} title={`${pending?.label ?? "Confirm action"}?`} description={`Confirm this action for ${order.publicReference}.`} confirmLabel={pending?.label ?? "Confirm"} destructive={pending?.requiresReason} onCancel={() => setPending(null)} onConfirm={confirm}>
      {pending?.requiresReason && <label className="field"><span>Reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={2} required /></label>}
    </AdminConfirmDialog>
  </>;
}
