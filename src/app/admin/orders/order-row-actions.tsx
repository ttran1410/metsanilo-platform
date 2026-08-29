"use client";

import { AdminRowActionMenu, IconEye, IconPencil, IconTrash, type ActionMenuItem } from "../ui/admin-row-action-menu";
import type { AdminOrder } from "./types/admin-order";
import type { OrderStatus } from "@/domain/order-transitions";

export function OrderRowActions({ canUpdate, canTransition, canDelete, nextAction, onInspect, onEdit, onQuickTransition, onDelete }: { order: AdminOrder; canUpdate: boolean; canTransition: boolean; canDelete: boolean; nextAction: { target: OrderStatus; label: string } | null; onInspect: () => void; onEdit: () => void; onQuickTransition: (target: OrderStatus) => void; onDelete: () => void }) {
  const items: ActionMenuItem[] = [
    { id: "view-details", label: "View Details", icon: <IconEye />, onClick: onInspect },
    ...(canUpdate ? [{ id: "edit-order", label: "Edit Order", icon: <IconPencil />, onClick: onEdit }] : []),
    ...(canTransition && nextAction ? [{ id: "quick-transition", label: nextAction.label, icon: <span className="text-emerald-600 font-bold">→</span>, onClick: () => onQuickTransition(nextAction.target) }] : []),
    { id: "delete-order", label: "Delete Order", icon: <IconTrash />, danger: true, disabled: !canDelete, onClick: onDelete },
  ];
  return <AdminRowActionMenu items={items} />;
}
