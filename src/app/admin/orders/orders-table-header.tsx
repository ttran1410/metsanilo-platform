import type { OrdersSortField } from "./orders-record-list-contract";

export function OrdersTableHeader({ allSelected, onToggleAll, sortField, sortDirection, onSort }: { allSelected: boolean; onToggleAll: (selected: boolean) => void; sortField: OrdersSortField; sortDirection: "asc" | "desc"; onSort: (field: OrdersSortField) => void }) {
  const sortable = [{ key: "ref", label: "Order Ref" }, { key: "customer", label: "Customer" }, { key: "fulfillment", label: "Fulfillment" }, { key: "source", label: "Source" }, { key: "payment", label: "Payment" }, { key: "status", label: "Status" }] satisfies Array<{ key: OrdersSortField; label: string }>;
  return <tr>
    <th className="p-3 w-10"><input type="checkbox" checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)} /></th>
    {sortable.slice(0, 4).map((column) => <SortableHeader key={column.key} field={column.key} label={column.label} active={sortField === column.key} direction={sortDirection} onSort={onSort} />)}
    <th className="p-3">Items &amp; Vol</th>
    {sortable.slice(4).map((column) => <SortableHeader key={column.key} field={column.key} label={column.label} active={sortField === column.key} direction={sortDirection} onSort={onSort} />)}
    <th className="p-3 text-right">Actions</th>
  </tr>;
}

function SortableHeader({ field, label, active, direction, onSort }: { field: OrdersSortField; label: string; active: boolean; direction: "asc" | "desc"; onSort: (field: OrdersSortField) => void }) {
  return <th className="p-3 cursor-pointer select-none hover:bg-slate-200/60 transition-colors" onClick={() => onSort(field)}><div className="inline-flex items-center gap-1"><span>{label}</span><span className={`text-[10px] font-bold ${active ? "text-primary opacity-100" : "text-slate-400 opacity-40"}`}>{active ? (direction === "asc" ? "▲" : "▼") : "↕"}</span></div></th>;
}
