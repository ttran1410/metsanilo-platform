"use client";

export function useDashboardActionController({ onError, onSuccess }: { onError: (message: string) => void; onSuccess: (kind: "confirm" | "automation", data?: { picking?: number; overdueReminders?: number }) => void }) {
  async function request(path: string, body: unknown, kind: "confirm" | "automation") {
    try { const response = await fetch(path, body === undefined ? { method: "POST" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json().catch(() => ({})); if (!response.ok) return onError(result.message ?? "Dashboard action failed."); onSuccess(kind, result.data); }
    catch { onError("An unexpected network error occurred."); }
  }
  return { confirm: (id: string, version: number) => request(`/api/admin/orders/${id}/status`, { status: "CONFIRMED", expectedVersion: version }, "confirm"), runAutomation: () => request("/api/admin/automation/run", undefined, "automation") };
}
