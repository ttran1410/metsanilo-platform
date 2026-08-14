-- Persist the implemented default catalogue for existing Admin and Manager users.
-- Staff and Content Creator remain explicit-grant roles by policy.
WITH default_permissions(permission) AS (VALUES
  ('orders.read'), ('orders.create'), ('orders.update'), ('orders.transition'), ('orders.payment.write'),
  ('catalog.product.write'), ('catalog.product.delete_unreferenced'), ('catalog.package.write'),
  ('availability.write'), ('availability.sold_out'), ('delivery.override'), ('cms.edit'), ('cms.publish'),
  ('media.write'), ('invoices.issue'), ('invoices.download'), ('picking.write'), ('pickers.manage'),
  ('customers.read'), ('customers.write'), ('shop_users.manage'), ('shop_permissions.assign'),
  ('settings.operational'), ('audit.read')
)
INSERT OR IGNORE INTO user_permissions (id, shop_id, user_id, permission, granted, updated_at)
SELECT lower(hex(randomblob(16))), u.shop_id, u.id, p.permission, 1, datetime('now')
FROM users u CROSS JOIN default_permissions p
WHERE u.role IN ('ADMIN', 'MANAGER');
