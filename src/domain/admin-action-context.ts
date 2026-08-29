import type { Role } from "./access";

export type AdminActionActor = { id: string; role: Role; shopId: string; email?: string | null };
export type AdminActionShop = { id: string };
export type AdminActionContext = { actor: AdminActionActor; shop: AdminActionShop };

export function assertAdminActionContext(context: AdminActionContext) {
  if (context.actor.shopId !== context.shop.id) throw new Error("Admin action context shop mismatch");
}
