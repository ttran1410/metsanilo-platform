"use client";

export function useOverviewActionController({ setError, setNotice, reload }: { setError: (message: string) => void; setNotice: (message: string) => void; reload: () => void }) {
  async function request(path: string, init: RequestInit, fallback: string, success: (data: { picking?: number; overdueReminders?: number } | undefined) => string) {
    try { const response = await fetch(path, init); const body = await response.json().catch(() => ({})); if (!response.ok) return setError(body.message ?? fallback); setNotice(success(body.data)); reload(); }
    catch { setError(fallback); }
  }
  return {
    quickConfirm: (id: string, reference: string, version: number) => request(`/api/admin/orders/${id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "CONFIRMED", expectedVersion: version }) }, "Could not confirm order", () => `Order ${reference} confirmed.`),
    runAutomation: () => request("/api/admin/automation/run", { method: "POST" }, "Could not run automation", (data) => `Automation checked ${data?.picking ?? 0} picking move(s) and ${data?.overdueReminders ?? 0} overdue reminder(s).`),
  };
}
