"use client";

import { anonymizeCustomerRecord } from "./customer-retention-admin-actions";
import { mergeCustomerProfiles } from "./customer-merge-admin-actions";

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
  async function requestAction(action: () => Promise<void>, fallback: string, success: string, customerId?: string) {
    try {
      await action();
      setMessage(success);
      await refresh(customerId);
    } catch (error) { setError(error instanceof Error ? error.message : fallback); }
  }
  return {
    saveNote: (customerId: string, notes: string) => request(`/api/admin/customers/${customerId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "notes", notes }) }, "Could not save note.", "Pinned staff note saved.", customerId),
    anonymize: (customerId: string) => requestAction(() => anonymizeCustomerRecord(customerId), "Anonymization failed.", "Customer personal contact data anonymized. Order ledger totals preserved for accounting."),
  };
}

export type CustomerSaveInput = { id?: string; name: string; mobile: string; email: string; facebookProfile: string; streetAddress: string; postalCode: string; city: string; preferredMethod: "PICKUP" | "DELIVERY"; preferredLanguage: "FI" | "EN"; marketingConsent: boolean; notes: string };

export async function saveCustomer(input: CustomerSaveInput): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch(input.id ? `/api/admin/customers/${input.id}` : "/api/admin/customers", { method: input.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, ...(input.id ? { action: "update" } : {}) }) });
    const body = await response.json().catch(() => ({})) as { message?: string };
    return response.ok ? { ok: true } : { ok: false, message: body.message ?? "Could not save customer profile." };
  } catch { return { ok: false, message: "An unexpected network error occurred." }; }
}

export async function mergeCustomers(primaryId: string, duplicateId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await mergeCustomerProfiles(primaryId, duplicateId);
    return { ok: true };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "An unexpected network error occurred." }; }
}
