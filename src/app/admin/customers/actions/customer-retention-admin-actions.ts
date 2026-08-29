async function requestCustomerRetention(path: string, init: RequestInit) {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(body.message ?? "Customer retention action failed.");
}

export function anonymizeCustomerRecord(customerId: string) {
  return requestCustomerRetention(`/api/admin/customers/${customerId}`, { method: "POST" });
}
