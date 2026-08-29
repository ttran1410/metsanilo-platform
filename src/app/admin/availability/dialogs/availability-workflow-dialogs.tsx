"use client";

import { DateInspectorDrawer, type DateOrdersEntry } from "./date-inspector-drawer";
import { FreezeModal } from "./freeze-modal";
import type { AvailabilityWorkspace } from "@/domain/availability";

type AvailabilityRow = AvailabilityWorkspace["rows"][number];

export function AvailabilityWorkflowDialogs({ inspectingDate, freezingRow, capacityMl, reservedMl, soldOut, soldOutReason, productName, ordersData, canManage, canSoldOut, cutoffOverride, onCloseInspector, onEditCapacity, onFreeze, onCutoffOverride, onQuickAdjust, quickAdjustDisabled, onCloseFreeze, onConfirmFreeze }: {
  inspectingDate: string | null;
  freezingRow: AvailabilityRow | null;
  capacityMl: number;
  reservedMl: number;
  soldOut: boolean;
  soldOutReason?: string | null;
  productName: string;
  ordersData?: DateOrdersEntry;
  canManage: boolean;
  canSoldOut: boolean;
  cutoffOverride?: "OPEN" | "CLOSED" | null;
  onCloseInspector: () => void;
  onEditCapacity?: () => void;
  onFreeze: () => void;
  onCutoffOverride?: (value: "OPEN" | "CLOSED" | null) => void;
  onQuickAdjust?: (delta: number) => void;
  quickAdjustDisabled: boolean;
  onCloseFreeze: () => void;
  onConfirmFreeze: (reason: string) => void;
}) {
  return <>
    {inspectingDate && <DateInspectorDrawer date={inspectingDate} capacityMl={capacityMl} reservedMl={reservedMl} soldOut={soldOut} soldOutReason={soldOutReason} productName={productName} ordersData={ordersData} canManage={canManage} canSoldOut={canSoldOut} onClose={onCloseInspector} onEditCapacity={onEditCapacity} onFreeze={onFreeze} cutoffOverride={cutoffOverride} onCutoffOverride={onCutoffOverride} onQuickAdjust={onQuickAdjust} quickAdjustDisabled={quickAdjustDisabled} />}
    {freezingRow && <FreezeModal date={freezingRow.availability.businessDate} productName={freezingRow.product.nameFi} mode={freezingRow.soldOut ? "reopen" : "freeze"} initialReason={freezingRow.availability.manualSoldOutReason ?? undefined} onClose={onCloseFreeze} onConfirm={onConfirmFreeze} />}
  </>;
}
