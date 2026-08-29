import Link from "next/link";
import { IconCopy } from "../ui/admin-row-action-menu";
import type { OrderStatus } from "@/domain/order-transitions";
import type { AdminOrder } from "../orders-listing";
import { OrderRowActions } from "./order-row-actions";
import { OrderRowStatusCell } from "./order-row-status-cell";
import { OrderRowSummaryCells } from "./order-row-summary-cells";
import { OrderRowSelectionCell } from "./order-row-selection-cell";

export type OrderRecordRowProps = {
  order: AdminOrder;
  selected: boolean;
  canUpdate: boolean;
  canTransition: boolean;
  canDelete: boolean;
  nextAction: { target: OrderStatus; label: string } | null;
  onToggleSelected: (selected: boolean) => void;
  onCopy: (value: string) => void;
  onInspect: () => void;
  onEdit: () => void;
  onQuickTransition: (target: OrderStatus) => void;
  onDelete: () => void;
};

export function OrderRecordRow({ order, selected, canUpdate, canTransition, canDelete, nextAction, onToggleSelected, onCopy, onInspect, onEdit, onQuickTransition, onDelete }: OrderRecordRowProps) {
  return <tr key={order.id} className="hover:bg-surface-muted/40 transition-colors">
    <OrderRowSelectionCell selected={selected} onToggle={onToggleSelected} />
    <td data-label="Order" className="p-3 font-bold"><div className="inline-flex items-center gap-1.5"><Link className="text-primary hover:underline font-mono" href={`/admin/orders/${order.id}`}>{order.publicReference}</Link><button type="button" title="Copy Order Reference" className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer" onClick={(event) => { event.stopPropagation(); onCopy(order.publicReference); }}><IconCopy className="w-3.5 h-3.5" /></button></div><span className="muted block text-[11px] font-normal">{order.createdAt.slice(0, 10)}</span></td>
    <td data-label="Customer" className="p-3">{order.customerId ? <Link className="text-primary hover:underline font-bold block w-fit" href={`/admin/customers/${order.customerId}`} title="View customer detail" onClick={(event) => event.stopPropagation()}>{order.customerName}</Link> : <strong className="text-ink block font-bold">{order.customerName}</strong>}<div className="inline-flex items-center gap-1"><span className="muted text-[11px]">{order.mobile}</span>{order.mobile && <button type="button" title="Copy Customer Mobile Phone" className="p-0.5 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer" onClick={(event) => { event.stopPropagation(); onCopy(order.mobile!); }}><IconCopy className="w-3 h-3" /></button>}</div></td>
    <OrderRowSummaryCells order={order} />
    <OrderRowStatusCell order={order} />
    <td data-label="Actions" className="p-3 text-right"><OrderRowActions order={order} canUpdate={canUpdate} canTransition={canTransition} canDelete={canDelete} nextAction={nextAction} onInspect={onInspect} onEdit={onEdit} onQuickTransition={onQuickTransition} onDelete={onDelete} /></td>
  </tr>;
}
