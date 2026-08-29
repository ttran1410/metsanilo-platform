"use client";

import { addOrderNote } from "./order-admin-actions";

export function useOrderNoteActionController({ onError }: { onError: (message: string) => void }) {
  return async function addNote(orderId: string, note: string) {
    try {
      await addOrderNote({ orderId, body: note });
      return true;
    } catch (error) { onError(error instanceof Error ? error.message : "An unexpected network error occurred."); return false; }
  };
}
