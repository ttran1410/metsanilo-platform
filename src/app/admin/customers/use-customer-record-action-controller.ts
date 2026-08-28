"use client";

export function useCustomerRecordActionController({ setError, setMessage, refresh }: { setError: (message: string) => void; setMessage: (message: string) => void; refresh: (customerId?: string) => Promise<void> }) {
  async function request(path: string, init: RequestInit, fallback: string, success: string, customerId?: string) {
    try {
      const response = await fetch(path, init);
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) return setError(body.message ?? fallback);
      setMessage(success);
      await refresh(customerId);
    } catch { setError("An unexpected network error occurred."); }
  }
  return {
    saveNote: (customerId: string, notes: string) => request(`/api/admin/customers/${customerId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "notes", notes }) }, "Could not save note.", "Pinned staff note saved.", customerId),
    anonymize: (customerId: string) => request(`/api/admin/customers/${customerId}`, { method: "POST" }, "Anonymization failed.", "Customer personal contact data anonymized. Order ledger totals preserved for accounting."),
  };
}
