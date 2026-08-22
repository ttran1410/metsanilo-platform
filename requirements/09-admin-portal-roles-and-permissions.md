# 09 — Admin Portal, Roles and Permissions

> **Active matrix — ADR-0005 and ADR-0015 apply.** The portal is one shop with `ADMIN`, `MANAGER`, `STAFF`, and `CONTENT_CREATOR`. Reporting v1 includes the operational Overview and permission-scoped existing-data reports. Platform Console, Google delivery settings, channels/shared inbox, suppliers, expenses, advanced finance, and video media remain deferred.

## 1. Navigation and modules

```text
Dashboard
Orders
Customers
Products & Packages
Product Media
Availability
Pickup & Delivery
Order Sources & Customer Areas
Reviews
Picker Applications
Contact Messages
Shared Inbox
Channel Content & Campaigns
Customer Segments
Content & Media
Shop Users, Roles & Permissions
Notifications
Settings
Shop Audit
Suppliers & External Purchases
Quality Grades & Buy Rates
Expenses
Picking & Staff Earnings
Reports & Exports
Invoices
```

There is no Platform Console or shop switcher. Shared Inbox, Channels, Suppliers, Expenses, and Picker Applications remain hidden until their modules ship. Reports & Exports appears only when the user holds at least one reporting permission.

Navigation is permission-aware, but hidden navigation is not authorization; every server operation enforces permission.

Every human shop-portal user must use MFA. Service identities are non-interactive and follow separate credential controls.

## 2. Dashboard

The dashboard presents actionable operational data for the current business date:

- New and overdue-new orders.
- Confirmed, picking, overdue-picking, ready, dispatched, completed, and exception counts.
- Litres and value by status/product/method.
- Capacity, reserved, remaining, natural/manual sold-out dates, and private override actor/reason for authorized internal users.
- Upcoming 7-day workload.
- New contact messages and external-picker records.
- Recent operational failures.
- Current-week fulfilled litres and fulfilled sales; recorded cash and outstanding amount remain separate measures.

Cards link to filtered lists. Values include an “as of” timestamp and use the active shop timezone, initially `Europe/Helsinki`.

## 3. List and detail standards

- Server-side search/filter/sort/pagination for potentially growing lists.
- Saved views are optional; URL/shareable filter state is preferred where safe.
- Personally identifiable data is shown only to permitted roles and excluded from generic analytics logs.
- Detail views show relevant history/audit and distinguish submitted snapshot from current profile.
- Destructive/high-impact actions require impact preview, confirmation, reason where applicable, and success/failure feedback.

## 4. Role definitions

### Admin (`ADMIN`)

Shop owner with every shop permission, including user/permission management, manual delivery-fee override, invoice/payment actions, picking records, CMS, products, capacity, and audit. Admin is not grantable by a Manager.

### Manager (`MANAGER`)

Employee with all operational permissions in the single shop and permission-assignment authority for Staff and Content Creator. Manager may create/approve/pay their own records. It cannot grant Admin.

### Staff

Employee with only assigned features. Staff may manage orders, invoice/payment records, participate in picking, and record litre/kg quantities when those permissions are assigned. Staff may manage content/products when assigned. Staff cannot manage users or grant permissions by default.

Staff may enter picking records for themselves or an external picker when assigned. Compensation, supplier, expense, and earnings modules are future scope.

### Content Creator (`CONTENT_CREATOR`)

Fixed-page CMS, product names/descriptions, pickup instructions, preview/publish, and up to four images, subject to assigned permissions. No order/payment/picking/user access unless explicitly granted.

## 5. Permission matrix

Rows for Platform Admin, channels, Google, suppliers, expenses, quality, and advanced finance remain future reference. Reporting-v1 rows are active and follow ADR-0015.

Legend: `M` manage, `V` view, `—` denied, `L` limited.

| Capability | Admin | Manager | Staff | Content Creator |
|---|---:|---:|---:|---:|
| Shop/user/permission management | M | M | — | — |
| Shop dashboard/operations | M | M | L: assigned | — |
| Orders/status/contact attempts | M: selected shop | M | M | — |
| Historical orders | M: selected shop | M | M if granted | — |
| Refund/payment record | M: selected shop | M | L: explicit permission | — |
| Customers/areas | M: selected shop | M | M | — |
| Customer anonymization | M: selected shop | M | — | — |
| Product identity/localization/window/archive/unreferenced delete | M: selected shop | M | M | M |
| Packages/media/prices | M: selected shop | M | M | L: media and read-only package/price |
| Per-date availability/manual sold-out | M: selected shop | M | M | — |
| Pickup locations, delivery origin/rules, and sources | M: selected shop | M | M | — |
| Google delivery settings | — | — | — | — |
| Quality grades/buy rates | M: selected shop | M | L: configure only with explicit `quality.configure`; denied by default | — |
| Reviews/picker applications/contact | M: selected shop | M | M | — |
| Shared inbox/reply | M: selected shop | M | L: if granted | — |
| Campaign/segment draft | M: selected shop | M | L: if granted | L: content draft if granted |
| Campaign publish/send/schedule | M: selected shop | M | L: explicit permission | — |
| Connect/disconnect provider accounts | M | M | — | — |
| CMS/media publish | M: selected shop | M | — | M |
| Shop users/roles/permissions | M | M | — | — |
| Shop-sensitive settings/retention | M: selected shop | M | — | — |
| Personal notification preferences | M | M | M | M |
| Shop audit | M | M | L: own/relevant events | — |
| Suppliers/external purchases | M: selected shop | M | L: if granted | — |
| Picking record submission (litres/kg + buy price) | M | M | L: explicit permission | — |
| Finance approve/reject/correct/mark paid, including own record | M | M | L: explicit permission | — |
| Picking records (litres/kg + buy price) | M | M | L: explicit permission | — |
| Other staff earnings/rates | M: selected shop | M | — unless finance permission | — |
| Overview | M | M | V: default | — |
| Capacity and demand report/CSV | M | M | V: default | — |
| Sales and fulfillment report/CSV | M | M | L: explicit permission | — |
| Payments and refunds report/CSV | M | M | L: explicit permission | — |
| Customer health report/CSV | M | M | L: explicit permission | — |
| Identifying customer drill-down | M | M | L: `customers.read` | — |
| Phase-two reports/PDF | — | — | — | — |
| Order Summary/invoice PDF | M: selected shop | M | L: if granted | — |

## 6. Suggested stable permission codes

`dashboard.read`, `reports.sales.read`, `reports.capacity.read`, `reports.payments.read`, `reports.customers.read`, `orders.read`, `orders.create`, `orders.update`, `orders.transition`, `orders.payment.write`, `invoices.issue`, `invoices.download`, `customers.read`, `customers.write`, `catalog.product.write`, `catalog.product.delete_unreferenced`, `catalog.package.write`, `media.write`, `availability.write`, `availability.sold_out`, `delivery.configure`, `delivery.override`, `picking.write`, `pickers.manage`, `reviews.moderate`, `messages.manage`, `cms.edit`, `cms.publish`, `shop_users.manage`, `shop_permissions.assign`, `settings.operational`, `audit.read`.

Admin and Manager receive all reporting-v1 permissions. Staff receives `dashboard.read` and `reports.capacity.read` by default; Manager may explicitly grant the other reporting permissions. Content Creator receives none by default. Report permission never grants identifying drill-down by itself; the target record’s permission remains required.

There are no provider cost controls in v0.0.1. Staff may retain `delivery.configure` and `delivery.override` only when explicitly assigned.

## 7. Notifications

In-app notifications are the authoritative operational inbox. Each user may toggle email per applicable category:

- New order.
- `NEW` over 15 minutes.
- Picking overdue at ready-review time.
- New contact message.
- New picker application.
- Shop job/channel failure (Manager) and platform/system failure (Platform Admin).
- Channel connection/webhook/send failure, scheduled campaign result, and shared-inbox assignment where applicable.

Disabling email does not suppress in-app notification or dashboard flags. Users can mark in-app notifications read, but that does not resolve the underlying order/message/application.

## 8. Audit expectations

Audit: authentication events, role/user changes, sensitive settings, product/price/capacity edits, order creation/edit/status/override, contact attempts, payment/refund records, customer merge/anonymization, review moderation, picker/message status, content publish/restore, and notification job failures.

Also audit tenant provisioning/suspension/support access, memberships/roles, Supplier/purchase/expense create/change/approval/payment, quality/buy-rate changes, Picking Entry lifecycle, report exports, product media, source/area changes, analytics-preference schema, channel connection/token lifecycle, inbox link/reply, segment/campaign audience/send outcomes, and Order Summary/invoice document events.

Audit entries include who/what/when/reason/correlation ID and a safe change summary. They are append-only to normal users.
