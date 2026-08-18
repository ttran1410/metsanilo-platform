/** Shared permission catalogue used by both the server guard and the admin UI. */
export const PERMISSIONS = [
  "dashboard.read", "notifications.read",
  "orders.read", "orders.create", "orders.update", "orders.transition", "orders.payment.read", "orders.payment.write", "orders.export", "orders.delete", "orders.archive", "orders.override_closed_date",
  "catalog.product.read", "catalog.product.write", "catalog.product.delete", "catalog.package.read", "catalog.package.write",
  "availability.read", "availability.write", "availability.sold_out",
  "delivery.read", "delivery.write", "delivery.override",
  "cms.read", "cms.edit", "cms.publish",
  "media.read", "media.write",
  "customers.read", "customers.write", "customers.anonymize", "customers.identity.resolve", "customers.consent.read", "customers.consent.write",
  "reviews.read", "reviews.create", "reviews.moderate", "reviews.feature", "reviews.visibility",
  "shop_users.read", "shop_users.manage", "shop_users.password_reset", "shop_permissions.read", "shop_permissions.assign",
  "settings.read", "settings.operational", "settings.sources.read", "settings.sources.manage", "settings.fulfillment.read", "settings.fulfillment.manage", "audit.read", "audit.export",
] as const;

export const COMING_SOON_PERMISSIONS = [
  "catalog.preview", "availability.override", "pickup.read", "pickup.write",
  "picking.read", "picking.write", "pickers.read", "pickers.manage",
  "invoices.read", "invoices.issue", "invoices.download",
  "reviews.edit_display", "reviews.confirm_publication", "cms.preview",
  "media.delete", "media.primary_image",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type Role = "ADMIN" | "MANAGER" | "STAFF" | "CONTENT_CREATOR";

export const HIGH_RISK_PERMISSIONS: Permission[] = [
  "orders.delete",
  "customers.anonymize",
  "orders.export",
  "audit.export",
  "catalog.product.delete",
  "delivery.override",
  "shop_users.manage",
  "shop_users.password_reset",
  "shop_permissions.assign",
  "settings.operational",
  "settings.sources.manage",
  "settings.fulfillment.manage",
];

export function isHighRiskPermission(permission: string): boolean {
  return HIGH_RISK_PERMISSIONS.includes(permission as Permission);
}

export function defaultPermissionsForRole(role: Role): Permission[] {
  if (role === "ADMIN") return [...PERMISSIONS];
  if (role === "MANAGER") return PERMISSIONS.filter((p) => p !== "orders.delete" && p !== "audit.export");
  if (role === "STAFF") return [
    "dashboard.read", "notifications.read",
    "orders.read", "orders.create", "orders.update", "orders.transition", "orders.payment.read", "orders.payment.write",
    "catalog.product.read", "catalog.package.read", "availability.read", "availability.write",
    "delivery.read", "delivery.write", "customers.read", "customers.write", "customers.consent.read",
    "reviews.read", "reviews.create", "reviews.moderate", "media.read", "media.write",
  ];
  if (role === "CONTENT_CREATOR") return ["cms.read", "cms.edit", "media.read", "media.write", "reviews.read", "reviews.create", "reviews.moderate"];
  return [];
}
