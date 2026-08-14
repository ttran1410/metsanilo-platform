-- Staff receive the approved operational groups by default. Sensitive user,
-- permission, settings, finance, CMS, and picking-management permissions stay explicit.
WITH default_permissions(permission) AS (VALUES
  ('orders.read'), ('orders.create'), ('orders.update'), ('orders.transition'), ('orders.payment.write'),
  ('delivery.override'),
  ('availability.write'), ('availability.sold_out'),
  ('customers.read'), ('customers.write'),
  ('catalog.product.write'), ('catalog.product.delete_unreferenced'), ('catalog.package.write')
)
INSERT OR IGNORE INTO user_permissions (id, shop_id, user_id, permission, granted, updated_at)
SELECT lower(hex(randomblob(16))), u.shop_id, u.id, p.permission, 1, datetime('now')
FROM users u CROSS JOIN default_permissions p
WHERE u.role = 'STAFF';
