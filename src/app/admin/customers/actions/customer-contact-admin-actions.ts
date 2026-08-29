export type CustomerContactChannel = "WHATSAPP" | "SMS" | "PHONE" | "OTHER";

async function requestCustomerContact(path: string, init: RequestInit) {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(body.message ?? "Customer contact action failed.");
}

export function confirmCustomerContact(customerId: string, channel: CustomerContactChannel) {
  return requestCustomerContact(`/api/admin/customers/${customerId}/contact-confirmation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ channel }),
  });
}

export function createCustomerRetentionHold(customerId: string, until: string, reason: string) {
  return requestCustomerContact(`/api/admin/customers/${customerId}/retention-hold`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ until, reason }),
  });
}

export function releaseCustomerRetentionHold(customerId: string) {
  return requestCustomerContact(`/api/admin/customers/${customerId}/retention-hold`, { method: "DELETE" });
}

export function renewCustomerContact(customerId: string) {
  return requestCustomerContact(`/api/admin/customers/${customerId}/contact-confirmation/renew`, { method: "POST" });
}
