import type { OrderStatus } from "@/domain/order-transitions";
import type { AdminOrder } from "../orders-listing";

export type OrdersSortField = "fulfillment" | "ref" | "customer" | "source" | "payment" | "status";

export type OrdersRecordListState = Readonly<{
  rows: AdminOrder[];
  selectedIds: string[];
  sortField: OrdersSortField;
  sortDirection: "asc" | "desc";
  page: number;
  limit: number;
  total: number;
}>;

export type OrdersRecordListActions = Readonly<{
  onSort: (field: OrdersSortField) => void;
  onToggleSelected: (orderId: string, selected: boolean) => void;
  onToggleAll: (selected: boolean) => void;
  onSelect: (order: AdminOrder) => void;
  onQuickAction: (order: AdminOrder, target: OrderStatus) => void;
  onDelete: (order: AdminOrder) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}>;
