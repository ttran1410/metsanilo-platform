import type { Role } from "@/lib/permissions";

export type AdminActionActor = {
  id: string;
  role: Role;
  shopId: string;
  email?: string | null;
  displayName?: string | null;
  username?: string | null;
  active?: boolean;
};
export type AdminActionShop = { id: string };
export type AdminActionContext = { actor: AdminActionActor; shop: AdminActionShop };

export function assertAdminActionContext(context: AdminActionContext) {
  if (context.actor.shopId !== context.shop.id) throw new Error("Admin action context shop mismatch");
}
