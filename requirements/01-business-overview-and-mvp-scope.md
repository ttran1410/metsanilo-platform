# 01 — Business Overview and MVP Scope

> **v0.0.1 release override — see [ADR-0005](decisions/0005-v001-single-shop-pilot-scope.md).** This document retains future roadmap context, but only the single-shop pilot scope is a two-day release commitment.

## 1. Product definition

METSÄNILO is a local seasonal-produce commerce and operations platform. Initially it sells fresh, cleaned wild berries in Pori/Satakunta. It may later support other berries, mushrooms, regions, payment integrations, customer accounts, picker operations, and marketing automation.

The customer proposition is:

> See what is available, reserve a fixed package for a chosen date, and receive it through pickup or local delivery.

The operating model is:

> Configure product capacity → collect reservation → contact customer → confirm → pick and prepare → hand over → retain operational and customer history.

## 2. Business goals

- Replace fragmented ordering with a searchable order record; manual phone/other orders may still be entered without a channel connector.
- Publish current seasonal products and date-specific capacity without code changes.
- Avoid overselling limited harvest capacity.
- Give staff a practical operational view of orders due today.
- Build a reusable customer history without requiring customer accounts.
- Build trust through transparent content, reviews, local identity, and clear pickup/delivery rules.
- Establish a small foundation for future payment, messaging, customer-account, and delivery enhancements.
- Provide basic payment records and existing-data reporting v1; invoices, picking costs, and full finance reporting remain deferred.

## 3. Actors

| Actor | Goal | Authentication |
|---|---|---|
| Visitor/customer | Browse, order, submit review or message | None |
| External picker | A person recorded for picking work; no login | None |
| Admin | Shop owner with all shop permissions | Required with MFA |
| Manager | Employee who manages operations, users/permissions, content, and picker records | Required with MFA |
| Staff | Employee who manages assigned order/payment/invoice work and records picking quantities | Required with MFA |
| Content Creator | Maintains public content, product content, and assigned media | Required with MFA |
| System scheduler | Apply time-based rules and reminders | Service identity |

Customers and external pickers do not receive portal accounts in v0.0.1. A public picker application is future scope.

## 4. MVP scope

### 4.1 Public website

- Home/landing page with hero, current products, next availability, benefits, short process, selected reviews, trust content, and clear order CTA.
- Separate Order, How It Works, Reviews, Become a Picker, About Us, and Contact pages.
- Finnish-default and English content with an obvious persistent language switch.
- Responsive, mobile-first experience.
- Accessible forms with clear success and error states.

### 4.2 Commerce and operations

- Fixed packages measured in litres.
- Date- and product-specific capacity.
- Daily Admin/Manager/Staff manual sold-out override that prevents new orders while keeping the internal reason private and all operational facts truthful.
- Dedicated shop Product module with localized product CRUD, an inclusive product availability window, and daily/weekly/monthly/custom-range capacity planning constrained to that window.
- Customer-created `NEW` orders and Manager/permitted-Staff-created orders.
- Manual confirmation/cancellation after staff contacts the customer outside the system.
- Pickup and delivery details; delivery is always “Delivery to be agreed.”
- Cash, bank transfer, and MobilePay record keeping without payment integration.
- Customer matching and order history.
- Order state machine, audit history, reminders, and operational dashboard.
- Record-only external pickers and minimal picking entries in litres or kilograms with unit-specific buy prices.
- Basic payment recording and downloadable invoice PDF for an eligible order; no automatic customer delivery.

### 4.3 Administration

- Orders, customers, products/packages, availability, pickup/delivery, CMS, reviews, contact messages, users/roles/permissions, settings, and a small operational dashboard.
- Search, filtering, controlled editing, and audit history appropriate to each module.
- In-app success/error states; background notification automation is deferred.

## 5. Explicitly out of MVP

- Online payment or automatic payment reconciliation.
- Customer registration, login, self-service order history, or repeat-order account features.
- Automatic customer email/SMS/Facebook/WhatsApp/order-status messages.
- Google route calculation, postal-zone classification, or optimization.
- Picker login, public picker applications, supplier/quality tracking, payroll, or picker payment.
- Facebook/WhatsApp connectors, shared inbox, broadcasts, and marketing automation.
- Statutory bookkeeping, tax filing, bank reconciliation, supplier payment integration, full expenses, and advanced reporting.
- Video media, raw HTML, and arbitrary CMS block composition.
- Promotion codes, loyalty, returns workflow, accounting integration, advanced forecasting, or multi-warehouse inventory.

The data model and interfaces should allow these capabilities to be added without redefining core order, payment, or customer identity concepts.

## 6. Key assumptions and resolved decisions

- `fulfillment_date`, not `created_at`, controls operational automation.
- `NEW` and `CONFIRMED` orders reserve capacity. Cancellation before picking releases it; a later non-fulfilled outcome remains post-picking unfulfilled capacity and does not reopen availability automatically.
- Capacity is stored in litres per product/date. Public MVP orders contain one fixed active package line with quantity 1; manual/historical orders may contain multiple lines and positive integer quantities sharing one fulfillment date and method.
- Orders require manual confirmation. An unsuccessful contact attempt may lead to `CANCELLED`.
- `READY` is a human-confirmed operational fact and is never set automatically in MVP.
- Delivery is always displayed as “Delivery to be agreed.” Admin, Manager, or Staff with `delivery.override` may enter an agreed fee and reason; no Google, postal-zone, or route call is made.
- Marketing consent and channel-specific consent are deferred; v0.0.1 collects only required order/privacy acknowledgement.
- Automatic customer-facing order messages are outside MVP; the on-page success receipt is the only automatic customer confirmation. An authorized user may explicitly initiate a compliant transactional channel message.
- Shop-user alerts are available in-app and by email. Each eligible portal user can enable or disable email notification categories.
- Public submission creates a reservation request, not a sales contract. The shop records contract formation when staff confirms the order. This timing must be prominent and unavoidable in the order path, no charge occurs before confirmation, and production remains subject to approved consumer terms and Finnish legal review.
- Every human portal user must use MFA.
- Revenue is recognized for management reporting when an order reaches `PICKED_UP` or `DELIVERED`; refunds are deducted in the week the refund occurs and linked to the original sale.
- Picking is recorded by picker/staff + product + picking date + quantity unit (`LITRE` or `KILOGRAM`) + unit-specific buy price, not allocated to individual customer orders. Customer orders and capacity remain litres-only.
- Admin and Manager may perform every shop action, including creating and approving the same invoice/payment or picking record. Staff may do so only with explicit permissions. Every action remains audited; no Finance Approver or External Accountant portal role is required.
- External pickers are simple records (name/contact/active/note), separate from staff and not supplier accounts.
- Weekly reporting follows ISO Monday–Sunday weeks in `Europe/Helsinki`.

## 7. Business success measures

Initial measures should be reported, not treated as release gates:

- Order submission completion rate.
- Median time from `NEW` to `CONFIRMED` or `CANCELLED`.
- Number and percentage of `NEW` orders exceeding 15 minutes.
- Capacity utilization by product/date.
- Oversell incidents; target: zero.
- Fulfillment outcome rates: picked up, delivered, cancelled, rejected, no-show, refunded.
- Repeat-customer rate based on matched identity.
- Order-source distribution: website, phone, other.
- Basic order payment/invoice and picked-quantity operational records (litres or kilograms); full profit reporting is future scope.
- Number and age of unanswered contact requests.

## 8. UX principles

- Show product, package price, remaining amount, fulfillment choices, and order CTA above unnecessary storytelling.
- When capacity remains, show exact remaining litres. At natural or manually overridden sell-out, show only a localized “Sold out” banner/state and no numeric remaining value or internal reason.
- Do not expose internal operational complexity to customers.
- Do not require sign-up.
- Explain that the request is received and will be confirmed manually.
- Preserve the customer-entered form on validation or transient submission errors.
- Make Finnish the configurable default locale while retaining an obvious language switch.
