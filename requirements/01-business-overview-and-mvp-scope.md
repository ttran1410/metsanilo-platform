# 01 — Business Overview and MVP Scope

## 1. Product definition

METSÄNILO is a local seasonal-produce commerce and operations platform. Initially it sells fresh, cleaned wild berries in Pori/Satakunta. It may later support other berries, mushrooms, regions, payment integrations, customer accounts, picker operations, and marketing automation.

The customer proposition is:

> See what is available, reserve a fixed package for a chosen date, and receive it through pickup or local delivery.

The operating model is:

> Configure product capacity → collect reservation → contact customer → confirm → pick and prepare → hand over → retain operational and customer history.

## 2. Business goals

- Replace fragmented ordering through Facebook Messenger, WhatsApp, SMS, and phone with a searchable order record.
- Continue accepting off-platform orders by allowing Manager/permitted Staff to record them manually.
- Publish current seasonal products and date-specific capacity without code changes.
- Avoid overselling limited harvest capacity.
- Give staff a practical operational view of orders due today.
- Build a reusable customer history without requiring customer accounts.
- Build trust through transparent content, reviews, local identity, and clear pickup/delivery rules.
- Establish a flexible foundation for future payment, messaging, customer-account, and delivery enhancements.
- Determine whether the business is economically viable through weekly revenue, cost, staff-earning, and estimated-profit reporting.
- Produce downloadable order invoice PDFs while keeping customer email delivery as a future capability.

## 3. Actors

| Actor | Goal | Authentication |
|---|---|---|
| Visitor/customer | Browse, order, submit review or message | None |
| Picker applicant | Learn about work and apply | None |
| Platform Admin | All Manager actions in an explicitly selected shop plus shop provisioning and platform management | Required with MFA |
| Manager | Shop owner with every application action inside assigned shop(s) | Required with MFA |
| Staff | Run orders, customers, availability, delivery, reviews, messages, pickers | Required with MFA |
| Content Editor (Content Creator) | Maintain public content/media and shop products within the permitted Product-module boundary | Required with MFA |
| System scheduler | Apply time-based rules and reminders | Service identity |

Customers and picker applicants do not receive portal accounts in the MVP.

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
- Daily Manager/Staff/Platform-Admin manual sold-out override that prevents new orders while keeping the internal reason private and all operational/financial facts truthful.
- Dedicated shop Product module with localized product CRUD, an inclusive product availability window, and daily/weekly/monthly/custom-range capacity planning constrained to that window.
- Customer-created `NEW` orders and Manager/permitted-Staff-created orders.
- Manual confirmation/cancellation after staff contacts the customer through an external channel.
- Pickup and basic local delivery rules.
- Cash, bank transfer, and MobilePay record keeping without payment integration.
- Customer matching and order history.
- Order state machine, audit history, reminders, and operational dashboard.
- Supplier profiles and external-berry purchase records.
- Expense entry, staff picking/earning records, approval/payment tracking, weekly financial reporting, and CSV/PDF exports.
- Downloadable invoice PDF for an eligible order; no automatic customer delivery.

### 4.3 Administration

- Orders, customers, products/packages, availability, pickup/delivery, CMS, reviews, picker applications, contact messages, users/roles/permissions, settings, notifications, and dashboard.
- Search, filtering, controlled editing, and audit history appropriate to each module.
- In-app and configurable email notifications for eligible portal users.
- Financial reports with access appropriate to Manager/permitted Staff and privacy restrictions on individual staff earnings.

## 5. Explicitly out of MVP

- Online payment or automatic payment reconciliation.
- Customer registration, login, self-service order history, or repeat-order account features.
- Automatic customer email/SMS/WhatsApp/order-status messages.
- Route calculation or optimization.
- Picker login, supply tracking, quality tracking, or picker payment.
- Autonomous, event-triggered, or drip marketing automation. Manually composed/scheduled broadcasts governed by consent and provider rules remain in MVP.
- Automated invoice emailing, statutory bookkeeping, payroll, tax filing, bank reconciliation, or supplier payment integration.
- Promotion codes, loyalty, returns workflow, accounting integration, advanced forecasting, or multi-warehouse inventory.

The data model and interfaces should allow these capabilities to be added without redefining core order, payment, or customer identity concepts.

## 6. Key assumptions and resolved decisions

- `fulfillment_date`, not `created_at`, controls operational automation.
- `NEW` and `CONFIRMED` orders reserve capacity. Cancellation before picking releases it; cancellation after `PICKING` begins records consumed/waste capacity and does not reopen availability automatically.
- Capacity is stored in litres per product/date. Public MVP orders contain one fixed active package line with quantity 1; manual/historical orders may contain multiple lines and positive integer quantities sharing one fulfillment date and method.
- Orders require manual confirmation. An unsuccessful contact attempt may lead to `CANCELLED`.
- `READY` is a human-confirmed operational fact and is never set automatically in MVP.
- When automatic Google delivery quoting is enabled, delivery within the configured maximum shorter driving-route distance from the validated shop origin is free at or above a configured litre threshold; below it, a configurable fee applies.
- When automatic quoting is disabled—or delivery is beyond that distance, ambiguous/unverifiable, has no drivable route, or encounters provider failure—Manager/permitted Staff agrees the final fee with the customer. Until then, delivery fee and final total remain pending; disabled mode sends no delivery-quote address/route request to Google.
- Marketing consent remains optional and unchecked by default.
- Automatic customer-facing order messages are outside MVP; the on-page success receipt is the only automatic customer confirmation. An authorized user may explicitly initiate a compliant transactional channel message.
- Shop-user alerts are available in-app and by email. Each eligible portal user can enable or disable email notification categories.
- Public submission creates a reservation request, not a sales contract. The shop records contract formation when staff confirms the order. This timing must be prominent and unavoidable in the order path, no charge occurs before confirmation, and production remains subject to approved consumer terms and Finnish legal review.
- Every human portal user must use MFA.
- Revenue is recognized for management reporting when an order reaches `PICKED_UP` or `DELIVERED`; refunds are deducted in the week the refund occurs and linked to the original sale.
- Staff picking earnings are a business cost. Reports show results both before and after this cost.
- Staff picking is recorded by staff + product + picking date, not allocated to individual orders.
- Manager may perform every shop action, including creating and approving the same Picking Entry, expense, or external purchase. Platform Admin inherits the same authority in selected-shop context. Every action remains audited; no Finance Approver or External Accountant portal role is required.
- External pickers are managed as Supplier profiles, separate from staff and picker applicants.
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
- Order-source distribution: website, WhatsApp, Messenger, SMS, phone, other.
- Weekly net revenue, operating result before staff picking cost, and estimated operating profit after staff picking cost.
- Staff/external-picker litres and cost per product.
- Number and age of unanswered contact/picker requests.

## 8. UX principles

- Show product, package price, remaining amount, fulfillment choices, and order CTA above unnecessary storytelling.
- When capacity remains, show exact remaining litres. At natural or manually overridden sell-out, show only a localized “Sold out” banner/state and no numeric remaining value or internal reason.
- Do not expose internal operational complexity to customers.
- Do not require sign-up.
- Explain that the request is received and will be confirmed manually.
- Preserve the customer-entered form on validation or transient submission errors.
- Make Finnish the configurable default locale while retaining an obvious language switch.
