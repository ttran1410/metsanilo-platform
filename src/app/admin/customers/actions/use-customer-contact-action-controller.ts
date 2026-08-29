"use client";

import { confirmCustomerContact, createCustomerRetentionHold, releaseCustomerRetentionHold, renewCustomerContact, type CustomerContactChannel } from "./customer-contact-admin-actions";

export function useCustomerContactActionController({ setError, setBusy, setMessage, refresh }: { setError: (message: string) => void; setBusy: (busy: boolean) => void; setMessage: (message: string) => void; refresh: (customerId?: string) => Promise<void> }) {
  async function requestAction(action: () => Promise<void>, fallback: string, success: string, customerId: string) {
    setBusy(true); setError("");
    try {
      await action();
      setMessage(success);
      await refresh(customerId);
    } catch (error) { setError(error instanceof Error ? error.message : fallback); }
    finally { setBusy(false); }
  }
  return {
    confirm: async (customerId: string, channel: CustomerContactChannel) => requestAction(() => confirmCustomerContact(customerId, channel), "Could not confirm customer contact.", `Contact confirmation saved through ${channel.toLowerCase()}.`, customerId),
    createHold: async (customerId: string, until: string, reason: string) => requestAction(() => createCustomerRetentionHold(customerId, until, reason), "Could not create retention hold.", "Retention hold saved.", customerId),
    releaseHold: async (customerId: string) => requestAction(() => releaseCustomerRetentionHold(customerId), "Could not release retention hold.", "Retention hold released.", customerId),
    renew: async (customerId: string) => requestAction(() => renewCustomerContact(customerId), "Could not renew contact confirmation.", "Contact confirmation renewed.", customerId),
  };
}
