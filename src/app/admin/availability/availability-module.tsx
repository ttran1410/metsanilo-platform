"use client";

import { AvailabilityWorkspace } from "./availability-workspace";
import type { AvailabilityWorkspace as AvailabilityData } from "@/domain/availability";

export function AvailabilityModule({
  initialWorkspace,
  loadInitialFromApi = false,
  canManage,
  canSoldOut,
  canCutoffOverride,
}: {
  initialWorkspace: AvailabilityData;
  loadInitialFromApi?: boolean;
  canManage: boolean;
  canSoldOut: boolean;
  canCutoffOverride: boolean;
}) {
  return <AvailabilityWorkspace initialWorkspace={initialWorkspace} loadInitialFromApi={loadInitialFromApi} canManage={canManage} canSoldOut={canSoldOut} canCutoffOverride={canCutoffOverride} />;
}
