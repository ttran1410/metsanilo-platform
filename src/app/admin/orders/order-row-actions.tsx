"use client";

import { AdminRowActionMenu, type ActionMenuItem } from "../ui/admin-row-action-menu";

export function OrderRowActions({ items }: { items: ActionMenuItem[] }) {
  return <AdminRowActionMenu items={items} />;
}
