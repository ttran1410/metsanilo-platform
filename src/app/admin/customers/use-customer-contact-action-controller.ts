"use client";

type ContactChannel = string;

export function useCustomerContactActionController({ setError, setBusy, setMessage, refresh }: { setError: (message: string) => void; setBusy: (busy: boolean) => void; setMessage: (message: string) => void; refresh: (customerId?: string) => Promise<void> }) {
  async function request(path: string, init: RequestInit, fallback: string, success: string, customerId: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(path, init);
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) return setError(body.message ?? fallback);
      setMessage(success);
      await refresh(customerId);
    } catch { setError("An unexpected network error occurred."); }
    finally { setBusy(false); }
  }
  return {
    confirm: (customerId: string, channel: ContactChannel) => request(`/api/admin/customers/${customerId}/contact-confirmation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel }) }, "Could not confirm customer contact.", `Contact confirmation saved through ${channel.toLowerCase()}.`, customerId),
    createHold: (customerId: string, until: string, reason: string) => request(`/api/admin/customers/${customerId}/retention-hold`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ until, reason }) }, "Could not create retention hold.", "Retention hold saved.", customerId),
    releaseHold: (customerId: string) => request(`/api/admin/customers/${customerId}/retention-hold`, { method: "DELETE" }, "Could not release retention hold.", "Retention hold released.", customerId),
    renew: (customerId: string) => request(`/api/admin/customers/${customerId}/contact-confirmation/renew`, { method: "POST" }, "Could not renew contact confirmation.", "Contact confirmation renewed.", customerId),
  };
}
