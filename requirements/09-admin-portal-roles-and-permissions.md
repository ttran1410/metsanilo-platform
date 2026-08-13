# 09 — Admin Portal, Roles and Permissions

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

Platform Admin uses a separate Platform Console for Shops, platform users/grants, entitlements, connection/provider health, support access, platform audit, and global security/settings. A user assigned to multiple shops sees an explicit shop switcher; every page prominently displays the active shop.

Navigation is permission-aware, but hidden navigation is not authorization; every server operation enforces permission.

Every human Platform Console and shop-portal user must use MFA. Service identities are non-interactive and follow separate credential controls.

## 2. Dashboard

The dashboard presents actionable operational data for the current business date:

- New and overdue-new orders.
- Confirmed, picking, overdue-picking, ready, dispatched, completed, and exception counts.
- Litres and value by status/product/method.
- Capacity, reserved, remaining, natural/manual sold-out dates, and private override actor/reason for authorized internal users.
- Upcoming 7-day workload.
- New contact messages and picker applications.
- Recent notification/job/channel failures for Manager or Platform Admin.
- Current ISO-week revenue, non-staff cost, result before staff picking cost, staff picking cost, and estimated profit after staff picking cost (Manager, Platform Admin in selected-shop context, or explicit financial-read permission only).
- Operational funnel including customer-declined and customer-cancelled outcomes, plus analytics-eligible form abandonment clearly labeled by coverage.

Cards link to filtered lists. Values include an “as of” timestamp and use the active shop timezone, initially `Europe/Helsinki`.

## 3. List and detail standards

- Server-side search/filter/sort/pagination for potentially growing lists.
- Saved views are optional; URL/shareable filter state is preferred where safe.
- Personally identifiable data is shown only to permitted roles and excluded from generic analytics logs.
- Detail views show relevant history/audit and distinguish submitted snapshot from current profile.
- Destructive/high-impact actions require impact preview, confirmation, reason where applicable, and success/failure feedback.

## 4. Role definitions

### Platform Admin (`PLATFORM_ADMIN`)

Platform-wide provisioning, suspension, entitlements, security, provider health, and cross-shop audit. In a visible explicitly selected shop, it inherits every Manager permission and action. It is not a grantable shop role and cannot be granted by a Manager. Last-Platform-Admin protections apply.

### Manager (`MANAGER`)

Shop owner with every application permission inside assigned shop(s): users/roles, operations, customers, products/packages/media, bounded availability and sold-out overrides, sources/areas, quality/buy rates, finance workflow actions (including self-approval/payment), reports, CMS, channels/shared inbox/campaigns, integrations, settings, and shop audit. It cannot access another shop, grant Platform Admin, or change platform-wide security/subscription infrastructure.

### Staff

Shop-scoped operational access: orders, customers, Product-module product records, packages/prices, bounded day/week/month/custom availability capacity, per-day manual sold-out, pickup/delivery, payment recording, reviews, picker applications, contact/shared-inbox work, dashboard, and granted non-sensitive functions. It cannot manage shop users/roles by default, change unrestricted settings, or approve financial records.

Staff may enter their own picking records and view their own earnings. Additional explicit permissions may allow entry of supplier purchases/expenses or operational reports, but Staff cannot approve any financial record or view other staff earnings by default.

### Content Editor (Content Creator)

CMS pages, announcements, media, preview/publish, and shop Product-module records. Content Editor may create/update/localize/activate/archive an assigned-shop product, set its inclusive availability window, and hard-delete it only when unreferenced. Package prices and per-date capacity are read-only. No access to orders, customers, applicants, messages, payments, finance, users/roles, or sensitive settings.

## 5. Permission matrix

Legend: `M` manage, `V` view, `—` denied, `L` limited.

| Capability | Platform Admin | Manager | Staff | Content Editor |
|---|---:|---:|---:|---:|
| Provision/suspend shops, platform entitlements/security | M | — | — | — |
| Audited support access to a shop | M | — | — | — |
| Shop dashboard/operations | M: selected shop | M | M | — |
| Orders/status/contact attempts | M: selected shop | M | M | — |
| Historical orders | M: selected shop | M | M if granted | — |
| Refund/payment record | M: selected shop | M | L: explicit permission | — |
| Customers/areas | M: selected shop | M | M | — |
| Customer anonymization | M: selected shop | M | — | — |
| Product identity/localization/window/archive/unreferenced delete | M: selected shop | M | M | M |
| Packages/media/prices | M: selected shop | M | M | L: media and read-only package/price |
| Per-date availability/manual sold-out | M: selected shop | M | M | — |
| Pickup locations, delivery origin/rules, and sources | M: selected shop | M | M | — |
| Shop Google delivery enable/disable | M: selected shop | M | — | — |
| Platform Google delivery kill switch/credentials | M | — | — | — |
| Quality grades/buy rates | M: selected shop | M | L: configure only with explicit `quality.configure`; denied by default | — |
| Reviews/picker applications/contact | M: selected shop | M | M | — |
| Shared inbox/reply | M: selected shop | M | L: if granted | — |
| Campaign/segment draft | M: selected shop | M | L: if granted | L: content draft if granted |
| Campaign publish/send/schedule | M: selected shop | M | L: explicit permission | — |
| Connect/disconnect provider accounts | M | M | — | — |
| CMS/media publish | M: selected shop | M | — | M |
| Shop users/roles/permissions | M: selected shop | M | — | — |
| Shop-sensitive settings/retention | M: selected shop | M | — | — |
| Personal notification preferences | M | M | M | M |
| Shop audit | M | M | L: own/relevant events | — |
| Suppliers/external purchases | M: selected shop | M | L: if granted | — |
| Expenses/purchases/Picking Entry submission | M: selected shop | M | L: enter if granted | — |
| Finance approve/reject/correct/mark paid, including own record | M: selected shop | M | — | — |
| Own picking entries/earnings | M: selected shop | M | M | — |
| Other staff earnings/rates | M: selected shop | M | — unless finance permission | — |
| Reports/CSV/PDF | M: selected shop | M | L: same scope as permissions | — |
| Order Summary/invoice PDF | M: selected shop | M | L: if granted | — |

## 6. Suggested stable permission codes

`platform.shops.manage`, `platform.entitlements.manage`, `platform.shop_context.select`, `orders.read`, `orders.create`, `orders.update`, `orders.transition`, `orders.override`, `orders.refund`, `documents.order_summary`, `invoices.preview`, `invoices.issue`, `invoices.download`, `customers.read`, `customers.write`, `customers.anonymize`, `areas.write`, `catalog.read`, `catalog.product.write`, `catalog.product.delete_unreferenced`, `catalog.package.write`, `media.write`, `availability.write`, `availability.sold_out`, `sources.write`, `delivery.configure`, `delivery.override`, `quality.configure`, `suppliers.read`, `suppliers.write`, `purchases.write`, `expenses.write`, `finance.approve`, `finance.mark_paid`, `picking.own.write`, `picking.all.write`, `earnings.own.read`, `earnings.all.read`, `reports.operational`, `reports.financial`, `reports.analytics`, `reports.export`, `channels.connect`, `channels.inbox.read`, `channels.reply`, `channels.content.write`, `channels.send`, `segments.write`, `reviews.moderate`, `pickers.manage`, `messages.manage`, `cms.edit`, `cms.publish`, `shop_users.manage`, `shop_roles.manage`, `settings.operational`, `settings.sensitive`, `audit.read`.

Manager receives the complete shop-permission catalogue. Platform Admin receives the same catalogue in selected-shop context plus platform permissions. Domain/data invariants remain mandatory; they are not permission denials.

Provider cost controls use `delivery.provider.toggle` for Manager/selected-shop Platform Admin and `platform.delivery_provider.manage` for Platform Admin only. Staff may retain `delivery.configure` and `delivery.override` without either provider-enablement permission.

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
