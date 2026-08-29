async function requestCustomerMerge(path: string, init: RequestInit) {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(body.message ?? "Could not merge profiles.");
}

export function mergeCustomerProfiles(primaryId: string, duplicateId: string) {
  return requestCustomerMerge(`/api/admin/customers/${primaryId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "merge", duplicateId }),
  });
}
