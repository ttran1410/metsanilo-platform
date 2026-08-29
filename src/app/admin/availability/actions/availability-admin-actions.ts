export type AvailabilityUpdateCommand = {
  id: string;
  expectedVersion: number;
  capacityMl: number;
  manualSoldOut: boolean;
  soldOutReason?: string | null;
  acceptsOrders?: boolean;
  cutoffOverride?: "OPEN" | "CLOSED" | null;
  source?: "MANUAL_EDIT" | "QUICK_ADJUST";
};

export async function updateAvailability(command: AvailabilityUpdateCommand) {
  const response = await fetch(`/api/admin/availability/${command.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      expectedVersion: command.expectedVersion,
      capacityMl: command.capacityMl,
      manualSoldOut: command.manualSoldOut,
      soldOutReason: command.soldOutReason ?? undefined,
      acceptsOrders: command.acceptsOrders,
      cutoffOverride: command.cutoffOverride,
      source: command.source,
    }),
  });
  const body = await response.json().catch(() => ({})) as { message?: string; data?: unknown };
  if (!response.ok) throw new Error(body.message ?? "Could not update availability.");
  return body.data;
}
