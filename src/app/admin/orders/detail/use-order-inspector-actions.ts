"use client";

import { useState, type FormEvent } from "react";
import type { OrderDetailOrder } from "./order-detail-query";
import { useOrderNoteActionController } from "../actions/use-order-note-action-controller";
import { useOrderStatusActionController } from "./use-order-status-action-controller";

export function useOrderInspectorActions({ order, detailOrder, reload, onOrderUpdated }: { order: OrderDetailOrder; detailOrder: OrderDetailOrder | undefined; reload: () => Promise<void>; onOrderUpdated: (order: OrderDetailOrder) => void }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const saveNote = useOrderNoteActionController({ onError: setError });
  const submitStatus = useOrderStatusActionController({ onError: setError, onSuccess: (data) => { if (data) onOrderUpdated(data as OrderDetailOrder); void reload(); } });
  const current = detailOrder ?? order;
  async function transition(next: string, reason?: string) { setBusy(true); setError(""); const succeeded = await submitStatus(current, next, reason); setBusy(false); if (succeeded) setNotice(`${current.publicReference} moved to ${next.replaceAll("_", " ")}.`); }
  async function addNote(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const body = String(new FormData(form).get("body") ?? "").trim(); if (!body) return; setBusy(true); const saved = await saveNote(order.id, body); setBusy(false); if (!saved) return; form.reset(); setNotice("Internal note added."); await reload(); }
  return { error, notice, busy, transition, addNote, clearNotice: () => setNotice("") };
}
