# 18 — Architectural Review and Requirements Synthesis

> **v0.0.1 release override — ADR-0005 applies.** Reduce this future-ready synthesis to one shop, Admin/Manager/Staff/Content Creator permissions, fixed-page four-image CMS, manual delivery fees, invoice/payment records, record-only pickers, and litre/kg picking records with unit-specific buy prices. Customer orders/capacity remain litres-only. Multi-tenant, Google, channel, video, supplier/expense/reporting, and marketing sections are deferred.

Version: 2.0  
Status: Corrected MVP synthesis  
Supersedes: Reviewed `Architectural Review & Requirements Synthesis for METSÄNILO` draft  
Initial shop: METSÄNILO, Pori/Satakunta, Finland  
Initial defaults: Finnish/English, EUR, `Europe/Helsinki`

## 1. Purpose and authority

This document is a concise, corrected synthesis of the approved METSÄNILO product and architecture baseline. It is intended for Product Owners, Software Engineers, Quality Engineers, UX/UI designers, security/privacy reviewers, and operational stakeholders.

It does not replace the detailed documents linked from [README](README.md). If this synthesis conflicts with a detailed requirement, business rule, form specification, state model, or acceptance criterion, the more specific detailed document wins.

## 2. Product definition

METSÄNILO is a multi-tenant-ready seasonal-produce commerce and operations platform.

Initially, METSÄNILO operates one shop selling fresh, cleaned wild berries in Pori/Satakunta. The platform foundation is designed so similar businesses can operate isolated shops and may later subscribe to the service.

The public customer experience remains simple:

```text
See availability → choose package/date → submit reservation → receive manually confirmed fulfillment
```

The operational platform supports:

```text
Shop → Product → Availability → Customer → Order → Picking → Pickup/Delivery
     → Supplier/Cost → Staff Earnings → Reporting → Communication
```

## 3. MVP boundaries

### 3.1 Included

- Multi-tenant shop isolation and manual Platform Admin shop provisioning.
- Public shop website and multilingual CMS.
- Products, packages, multiple images, uploaded video, and YouTube/Vimeo media.
- Date/product availability measured in litres.
- Public and manually recorded orders without customer accounts.
- Manual payment-method/status recording without a payment gateway.
- Customer profiles, matching, areas, history, and order navigation.
- Pickup and basic postal-zone delivery rules.
- Order lifecycle, reminders, inline transitions, contact attempts, and audit.
- Configurable order sources and future-ready campaign/referrer attribution storage.
- Reviews, picker applications, and contact messages.
- Suppliers, external purchases, quality grades, effective buy prices, and expenses.
- Staff Picking Entries, earnings, approval, and payment tracking.
- Weekly/custom financial and operational reports with CSV/PDF export.
- Operational/financial dashboard and in-app notifications with configurable email copies.
- Order Summary PDF and Invoice PDF.
- Facebook Page publishing, Facebook Group manual-share preparation, WhatsApp transactional/marketing messaging, scheduling, segments, and shared inbox.
- Consent-aware first-party funnel/form-abandonment analytics.
- Platform Admin, Manager, Staff, and Content Editor access models.

### 3.2 Deferred but architecturally supported

- Automated merchant monthly subscription billing, trials, dunning, plan checkout, and self-service shop onboarding.
- Online customer payment processing and automatic reconciliation.
- Customer accounts and customer self-service history.
- Route optimization.
- Picker login, quality/output workflow, and picker payment beyond staff Picking Entries.
- Facebook Group automatic publishing unless a future supported provider capability enables it.
- Instagram connector.
- Automated invoice email delivery, e-invoicing, statutory bookkeeping, payroll, tax filing, and accounting integration.
- Campaign-to-sales attribution report UI; attribution identifiers may be stored now.

## 4. Multi-tenant platform and roles

### 4.1 Tenant boundary

Every shop-owned record and operation belongs to exactly one tenant/shop. This includes public content, products, media, customers, orders, availability, finance, reports, users, exports, jobs, analytics, channel connections, campaigns, inbox conversations, files, caches, and settings.

Platform-owned records are separate and may not have a tenant ID. They include the shop registry, Platform Admin grants, platform security/audit, entitlement definitions, provider/platform configuration, and future subscription accounts.

Platform Admin may perform cross-shop platform queries or enter a shop through explicit, visible, audited selected-shop context, where it inherits every Manager action. Ordinary shop users never receive access merely by supplying a tenant identifier.

### 4.2 Roles

| Role | Scope | Primary authority |
|---|---|---|
| `PLATFORM_ADMIN` | Platform-wide + selected shop | Every Manager action in selected-shop context plus provision/suspend shops, platform security, entitlements, and provider health |
| `MANAGER` | Assigned shop(s) | Shop owner: every shop-scoped application action, including financial self-approval |
| `STAFF` | Assigned shop(s) | Permission-controlled daily operations; employee or contractor |
| `CONTENT_EDITOR` | Assigned shop(s) | CMS/media and Product-module identity/localization/availability-window management; user-facing alias “Content Creator” |

One User may have different TenantMembership roles in different shops. Manager cannot grant Platform Admin or access another shop.

An active shop must retain at least one active Manager. The last Platform Admin cannot be removed, demoted, or suspended.

### 4.3 Subscription-ready design

The MVP manually provisions shops and manually assigns a platform-defined entitlement set. Stable capability keys and limits allow a future subscription service to control access without migrating shop-owned data.

Subscription commerce is a separate future financial domain and must not be mixed with a shop’s customer orders, invoices, or payments.

## 5. Public website and customer experience

### 5.1 Pages

- Home.
- Order.
- How It Works.
- Reviews.
- Become a Picker.
- About Us.
- Contact.
- Privacy and required legal information.

All public pages use published shop content and support the shop’s configured locales. The initial METSÄNILO shop supports Finnish and English.

### 5.2 Customer account policy

Customers do not register or log in during MVP. A successful public submission returns an on-screen **pending-reservation receipt**, not a confirmation that the order has been accepted.

The receipt contains an opaque public order reference and explicitly explains that shop staff must confirm the reservation.

### 5.3 CMS workflow

Manager and Content Editor manage localized Home, How It Works, About Us, Become a Picker, Contact, footer, announcements, and reusable media. Content supports draft/published state, preview, locale validation/fallback policy, accessible image metadata, basic revision history, and restore/republish.

Products, packages, availability, orders, reviews, and other operational records remain typed business data; they are not editable as arbitrary CMS content.

### 5.4 Form design and validation

The field-level authority is [06 — Form and Field Specifications](06-form-and-field-specifications.md). It defines layout, required/conditional fields, dynamic behavior, validation ranges, privacy acknowledgements, anti-spam behavior, accessible errors, and localized success states for:

| Form | Key controls |
|---|---|
| Public order | Product/package/quantity, open non-past date, pickup/delivery, contact details, conditional address, privacy acknowledgement, optional marketing choice, final review |
| Manual/historical order | Customer/source search, actual outcome and fulfillment facts, payment evidence, override reason, historical-report warning |
| Contact | Name, at least email or mobile, category, optional order reference, subject/message, privacy acknowledgement |
| Picker application | Contact/location, transport, interests, availability/experience, privacy acknowledgement; no bank, tax, identity, or health data |
| Public review | Public display name, rating/text, optional product, publication acknowledgement, moderation contact |
| Shop-portal forms | Customer, product/media/package, availability, CMS, supplier/purchase/quality, expense, Picking Entry, source, invoice/document, channel, segment, campaign, and inbox forms |

Client-side validation supports usability, but server-side validation, permission checks, tenant scope, current configuration, and current capacity are always authoritative.

## 6. Products, packages, and media

### 6.1 Products and media gallery

A product supports:

- Localized name and description.
- Multiple images.
- Uploaded video.
- Allowlisted YouTube/Vimeo video references.
- One active primary media item.
- Localized caption, alternative text, and transcript metadata where applicable.
- Display ordering and archive state.
- Required inclusive availability start/end business dates in the shop timezone.

Platform Admin in an explicitly selected shop, Manager, Staff, and Content Editor may manage the shop Product record. Content Editor cannot change package prices or per-date capacity. Referenced products archive; hard delete is restricted to records proven unreferenced in the active shop.

The UX encourages external video URLs to reduce storage and bandwidth, while uploaded video remains supported under shop/platform quotas and file, duration, scanning, and processing limits.

### 6.2 Fixed packages and public quantity

Packages are configurable rather than hard-coded. Each package stores litres, price, localized label, active period, and display order. Public MVP quantity is fixed to 1; package size is the customer's volume choice. Manual and historical order lines may use another positive integer quantity.

Initial intended configuration:

| Package | Public quantity behavior |
|---|---|
| 2 L | Quantity fixed to 1; no control |
| 3 L | Quantity fixed to 1; no control |
| 5 L | Quantity fixed to 1; no control |
| 10 L | Quantity fixed to 1; no control |

Server validation is authoritative. A manipulated public request with quantity other than 1 is rejected. Manual shop-portal orders may use multiple smaller packages subject to capacity.

## 7. Customers

### 7.1 Customer data

A Customer may contain:

- Name.
- Primary mobile number.
- WhatsApp number, optionally the same as primary mobile.
- Optional email.
- Messenger/Facebook display name.
- Stable provider identifier when available.
- Preferred contact channel.
- Addresses.
- Optional customer area.
- Consent evidence, preferences, internal notes, and lifecycle state.

### 7.2 Customer matching

Matching occurs only within the current shop:

1. Exact normalized primary-mobile or WhatsApp number.
2. Exact normalized email.
3. Exact stable Messenger/provider identifier.
4. Display name only suggests a possible match and never auto-links.

When no candidate exists, order creation creates a normal new Customer. Conflicting or ambiguous candidates must never be auto-linked/merged: public submission creates a provisional Customer flagged for Manager/Staff resolution while preserving the submitted order snapshot.

### 7.3 Customer area

Area is optional. The system may derive it from configured postal/address mappings and records the derivation source/confidence. Manager/permitted Staff may override it manually; the override remains auditable.

### 7.4 Profile navigation

The profile shows order count, completed count, recognized revenue/lifetime summary, latest activity, and a link to the Orders page filtered by immutable customer ID. Order list/detail links may open the customer profile in a new tab.

Historical order snapshots are not rewritten when the current customer profile changes.

### 7.5 Privacy and anonymization

“Delete customer” is implemented as an authorized, audited anonymization workflow when order/accounting/audit facts must be retained. Direct identifiers in the current profile and retained order snapshots are removed or replaced where legally permitted, while non-identifying monetary, product, volume, status, and audit facts remain. An anonymized customer is suppressed from marketing and operational targeting.

## 8. Orders, capacity, and fulfillment

### 8.1 Public order transaction

Successful submission must atomically:

1. Validate the idempotency key.
2. Resolve the shop and shop timezone.
3. Validate active product/package/date, public quantity rules, and effective manual/natural sold-out state.
4. Recalculate litres, price, delivery classification, fee, and total; outside/unverifiable delivery stores null/pending fee and final total until agreement.
5. Atomically secure sufficient capacity.
6. Match, create, or provisionally associate the same-shop Customer under the conflict rules.
7. Create Order, item/customer/fulfillment/price/source snapshots, and status history.
8. Create the capacity movement and notification outbox event.
9. Commit before returning the receipt.

Any retry using the same idempotency key returns the original committed result. Application-only “check then insert” capacity logic is prohibited.

### 8.2 Capacity

Capacity is managed per shop, product, and fulfillment business date in litres. Manager/Staff (or Platform Admin in selected-shop context) can author one day, ISO week, calendar month, or custom range; the command resolves atomically to date rows and every date must fall within the product's inclusive availability window:

```text
remaining_litres = capacity_litres - reserved_litres
```

The invariant is:

```text
0 <= reserved_litres <= capacity_litres
```

`NEW` and `CONFIRMED` reserve capacity. Forward fulfillment states retain/consume it. Public MVP orders contain one item line; manual/historical orders may contain multiple item lines sharing one fulfillment date and method.

Platform Admin, Manager, and Staff may set a private audited `manual_sold_out` override per product/date. Effective public state is sold out when that override is active or remaining litres are zero. Sold-out views show a localized banner, hide numeric remaining litres/internal cause, disable the date, and reject new public/live-manual orders. Otherwise exact positive remaining litres are shown. The override never changes existing reservations, capacity movements, orders, fulfillment, revenue, expenses, or other transaction facts; internal operations reporting distinguishes manual from natural sell-out.

Authorized capacity editing remains available for the current business date and future in-window dates. The current date does not become read-only at cutoff: a write may increase capacity or reduce it to no less than reserved litres, uses optimistic/transactional concurrency control, and immediately recomputes effective availability. The write does not itself bypass cutoff, reopen `accepts_orders`, or modify historical transaction facts; past dates remain immutable availability history.

Capacity is released exactly once for:

- `CUSTOMER_DECLINED`.
- `CANCELLED` from `NEW`/`CONFIRMED`.
- `CANCELLED_BY_CUSTOMER` from `CONFIRMED`.

Capacity is not restored for:

- `REJECTED`.
- `NO_SHOW`.
- `CANCELLED`/`CANCELLED_BY_CUSTOMER` from `PICKING`, `READY`, or `OUT_FOR_DELIVERY`; these record consumed/waste litres.
- `REFUNDED`.

### 8.3 Manual and historical orders

Manager/permitted Staff may create normal manual orders received through configured sources such as WhatsApp, Facebook/Messenger, SMS, phone, or other.

Public customers cannot choose a past fulfillment date. Backdated orders are created only through the historical workflow with actual source, outcome, fulfillment date/time, payment facts where applicable, and audit reason.

Historical orders:

- Do not retroactively mutate past availability.
- Do affect reports using their actual business event/outcome dates.
- Preserve their later database `created_at` as a separate “recorded at” fact.
- May represent evidence-appropriate terminal outcomes. A historical refund records its completed-sale event first and the refund event second; it is never a bare unexplained refund.

### 8.4 Configurable order sources

Each shop manages stable, localized Order Sources. Website orders receive the configured website source automatically; manual/historical orders require a source. Used sources are archived rather than deleted, and orders retain a source snapshot.

Optional campaign/referrer attribution may be stored separately from the canonical source.

### 8.5 Payment recording

MVP payment methods are `CASH`, `BANK_TRANSFER`, and `MOBILEPAY`, with an extensible value model. Payment status is separate from fulfillment status and supports `UNPAID`, `PENDING`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`, and `FAILED`.

No payment gateway authorization or automatic reconciliation occurs in MVP. Paid/refund changes require actor, timestamp, and relevant amount/reason evidence. A completed pickup/delivery may remain unpaid only through an explicit confirmation, for example when an invoice or bank transfer will settle later.

A partial refund keeps the fulfillment status `PICKED_UP`/`DELIVERED` and changes payment summary to `PARTIALLY_REFUNDED`. Only full cumulative refund changes the order status to `REFUNDED`; refunds may never exceed the refundable amount.

Public submission creates a pending reservation request. The sales-contract event is recorded only when authorized staff confirms it after any required delivery agreement. That timing must be prominent and unavoidable in the order path, no charge occurs before confirmation, and the exact terms/pre-contract disclosures require Finnish legal approval before production.

## 9. Order lifecycle

### 9.1 Normal paths

```text
Pickup:
NEW → CONFIRMED → PICKING → READY → PICKED_UP

Delivery:
NEW → CONFIRMED → PICKING → READY → OUT_FOR_DELIVERY → DELIVERED
```

### 9.2 Exception and terminal outcomes

- `NEW → CUSTOMER_DECLINED`: customer explicitly declines before confirmation; reason required.
- `NEW → CANCELLED`: unreachable or shop/business cancellation; reason required.
- After confirmation → `CANCELLED_BY_CUSTOMER`: customer-initiated cancellation; reason required.
- Eligible operational states → `CANCELLED`: shop/business cancellation.
- `READY`/`OUT_FOR_DELIVERY → REJECTED` or `NO_SHOW` as applicable.
- `PICKED_UP`/`DELIVERED → REFUNDED` only when the full refundable amount is reached; partial refund remains completed with payment summary `PARTIALLY_REFUNDED`.

### 9.3 Inline status editing

The Orders list shows only permitted next transitions. A simple transition may use a compact confirmation. Any action requiring a reason, contact evidence, payment, delivery information, refund details, or consequence warning opens a dedicated dialog.

All transitions use expected status/version checks, server authorization, business-rule validation, and audit.

## 10. Order automation and timing

All schedules use the shop-configured IANA timezone. The initial METSÄNILO shop uses `Europe/Helsinki`.

### 10.1 Picking start

At the configured picking-start time, initially 10:00, orders where:

```text
fulfillment_date = current shop business date
AND status = CONFIRMED
```

transition idempotently to `PICKING`.

A same-day order confirmed at or after picking start and before cutoff transitions immediately to `PICKING`. Before picking start, it remains `CONFIRMED`.

### 10.2 Ready review

At the configured ready-review time, initially 19:00, today’s orders still in `PICKING` become overdue and trigger shop-user notifications. They remain `PICKING`; only a human may confirm `READY`.

### 10.3 New-order SLA

If an order remains `NEW` for 15 minutes, the system creates one initial overdue reminder and dashboard flag.

Transition to `CONFIRMED`, `CUSTOMER_DECLINED`, or `CANCELLED` resolves the overdue condition. Viewing the order alone does not resolve it.

Jobs are durable, idempotent, recover missed execution after restart, and do not overwrite a newer human state.

### 10.4 Shop-user notifications

New orders, Contact requests, and Picker applications create in-app notifications. The 15-minute `NEW`-order reminder and 19:00 ready-review alert also appear in-app. Each user may enable or disable email copies by applicable category; disabling email never suppresses the authoritative in-app notification or dashboard flag.

Customer notifications are not automatic. Customer-facing WhatsApp/Facebook/Messenger messages are separate, explicit channel actions governed by permission, purpose, provider capability, consent/template/window rules, and audit.

## 11. Pickup and delivery

### 11.1 Pickup

Platform Admin in selected-shop context, Manager, and Staff configure pickup locations with complete customer-visible addresses, localized instructions, active dates, and time slots. Checkout selection/review and the post-commit success state show the snapshotted address/instructions. The initial default pickup time is 20:00 with precedence:

```text
specific-date override → weekday default → shop global default
```

### 11.2 Delivery

The same three roles configure delivery origin, maximum driving distance (initially 5,000 m), litre threshold, local fee, and fallback. Platform Admin owns a global kill switch; Platform Admin/Manager own a default-off per-shop Google toggle. Effective enablement also requires credentials, validated origin, and available circuit. When enabled, customers confirm a Google-validated destination and the backend calls Routes API `ComputeRoutes` with `DRIVE`/shorter-distance routing; `distanceMeters <= 5000` is inside. When disabled, no Google delivery call occurs and the same public manual-agreement fallback is used, with private `PROVIDER_DISABLED`; unconsumed automatic quotes are invalidated. The signed quote binds destination, origin/rule/enablement version, provider outcome/distance, fee, and expiry. Postal zones remain fallback/reporting data, not the classifier.

Initial proposed seed values—not hard-coded rules—are:

```text
Within configured maximum provider-returned driving distance:
- order >= 20 L → €0 delivery fee
- order < 20 L  → €3 delivery fee

Beyond the maximum, unverifiable/no-route, or provider failure:
- delivery and fee must be agreed manually before confirmation
```

Threshold, fee, zones, cutoff, and date overrides remain shop configuration. The exact same-day cutoff is still an open business decision; 14:00 is only a proposed seed value.

## 12. Reviews, picker applications, and contact messages

### 12.1 Reviews

- Public review submission without account.
- Initial status `PENDING` and not publicly visible.
- Manager/permitted Staff moderation.
- Original text remains immutable/auditable when display text is edited.
- Only approved/published reviews appear publicly.

### 12.2 Picker applications

- Public application and privacy acknowledgement.
- Management statuses: `NEW`, `CONTACTED`, `APPROVED`, `ACTIVE`, `INACTIVE`, `REJECTED`.
- No picker account, production, quality, or payment workflow in MVP.

### 12.3 Contact messages

- Categorized public Contact form.
- Operational statuses: `NEW`, `READ`, `REPLIED`, `CLOSED`.
- The shared channel inbox is separate from the website Contact-message module.

## 13. Suppliers, external purchases, quality, and staff earnings

### 13.1 Suppliers

External pickers/vendors are Supplier profiles, separate from Customers, Users/Staff, and Picker Applicants.

### 13.2 External-purchase quality

Manager or Staff with `quality.configure` may manage shop-specific grades such as A/B/C/D:

- Stable code.
- Localized name and quality condition.
- Ranking/display order.
- Active/archive state.

Effective external buy rates are configured by product and quality grade, with optional supplier-specific override. Rate resolution is:

```text
supplier-specific product+grade rate
→ shop product+grade default
```

Each external-purchase line has one product, grade, litres, and snapshotted rate. Mixed grades use separate lines. Manual rate/total override requires permission and reason.

Quality grade affects external purchases only in MVP. The data design permits future staff-picking or customer-sale use without enabling it now.

### 13.3 Staff Picking Entries

The record unit is:

```text
staff + product + picking date + production quantity + compensation calculation
```

It is not allocated to individual customer orders.

Supported compensation methods:

- `PER_LITRE`.
- `PER_HOUR`.
- `FIXED`.
- Approved manual adjustment with mandatory reason.

Workflow:

```text
DRAFT → SUBMITTED → APPROVED → PAID
```

Draft/rejected records do not affect reports. Approved and Paid records affect cost exactly once. Manager and Platform Admin in selected-shop context may perform every workflow action, including approving/paying a record they created/submitted; each action is independently audited. No Finance Approver or External Accountant portal role exists.

## 14. Finance and reporting

### 14.1 Revenue recognition

Management revenue is recognized once when an order first reaches `PICKED_UP` or `DELIVERED`. Payment status alone does not recognize an unfulfilled order.

Refunds reduce net revenue in the business period containing the refund and retain a link to the original sale.

### 14.2 Canonical financial metrics

```text
Gross recognized revenue
- refunds recognized in period
= net revenue

Net revenue
- external berry purchase cost
- fuel/delivery cost
- packaging/bucket cost
- equipment/allocated cost
- other approved non-staff operating cost
= operating result before staff picking cost

Operating result before staff picking cost
- approved staff picking earnings
= estimated operating profit after staff picking cost
```

Both result lines are always displayed. Estimated operating profit is management information, not statutory or taxable profit.

### 14.3 Reports

- Weekly financial overview and custom ranges.
- Orders, litres, revenue, product/package mix, and average order value.
- Pickup versus delivery and delivery economics.
- Capacity utilization and fulfillment outcomes.
- Customer new/repeat and area analysis.
- Configurable order-source distribution.
- Staff/external-supplier volume and costs.
- Pre-confirmation customer-decline and post-confirmation cancellation reasons.
- Operational and analytics funnels.
- CSV and PDF export with filters, shop, timezone, formula version, and data cutoff.

Weekly periods use ISO Monday–Sunday in the shop timezone.

### 14.4 Dashboard

The shop dashboard presents actionable operational counts and, for Manager, Platform Admin in selected-shop context, or explicit financial-read scope, current-week financial summaries. It includes new/overdue orders, today’s fulfillment stages, low/closed capacity, natural/manual sold-out dates, new Contact requests and Picker applications, failed jobs/channel actions, recognized revenue, non-staff cost, result before staff picking cost, staff picking cost, and estimated profit after staff picking cost.

Dashboard cards link to the corresponding filtered module. Personal or shop-sensitive finance is hidden from users without permission.

### 14.5 Expenses

Initial configurable categories include packaging/buckets, external purchases, fuel/delivery, equipment, staff picking, and other.

Allocation supports:

- One-time recognition.
- Recurring occurrences.
- Manual allocation that exactly reconciles to the source amount.

Approval recognizes management cost; Paid tracks settlement and never counts the cost again.

External purchases and staff Picking Entries are specialized source records. If they also produce/link to a canonical expense fact, reports deduplicate by canonical cost identity so one business cost is never counted twice.

## 15. Order Summary and Invoice PDFs

### 15.1 Order Summary/Confirmation PDF

- Shop and order identity.
- Order status/reference.
- Customer and fulfillment snapshot.
- Items, litres, prices, delivery fee state, total, and payment state.
- Localized template and generation timestamp.
- No invoice number.
- No automatic customer delivery.

### 15.2 Invoice PDF

- Unique number and immutable issued version.
- Seller/customer/order and line snapshots.
- Delivery and total/payment information.
- Preview, issue, download, audit, and future delivery boundary.

VAT/tax fields exist in the system design but remain hidden from MVP invoice UI/PDF until Business enables an approved shop tax configuration after qualified accounting advice where needed; the adviser is not a portal role.

Generating either document never sends it automatically. An authorized user may download it or explicitly share it using an allowed channel workflow.

## 16. Facebook, WhatsApp, scheduling, and shared inbox

### 16.1 Provider-neutral connections

Channel connections belong to one shop. Credentials are encrypted/restricted, scopes and token expiry are monitored, OAuth state is verified, and provider webhook signatures are validated.

The platform uses connector capability discovery rather than assuming all providers/accounts support all actions.

### 16.2 Facebook

- Facebook Page publish-now and scheduled posts when supported.
- Text, image/video/link variants and provider result tracking.
- Facebook Group content package/manual-share workflow in MVP.
- Future Group auto-publish only if a supported authorized provider capability becomes available.

### 16.3 WhatsApp

- Transactional order/service messages explicitly initiated by an authorized user.
- Marketing broadcasts.
- Approved template and customer-service-window enforcement.
- Delivery/read/failure states when exposed by provider.
- Scheduling, rate/frequency controls, consent, suppression, and opt-out handling.

An order status transition does not automatically send a customer message in MVP.

### 16.4 Customer segments

Initial permitted segmentation may use customer area, order/product history, order count/date/status, fulfillment method, configured source, channel availability, consent, suppression, and marketing frequency.

Sensitive-trait inference and segmentation from private message content are prohibited.

Audience membership and consent are re-evaluated at dispatch. The preview shows eligible/excluded counts and reasons.

### 16.5 Shared inbox

Supported inbound Facebook/WhatsApp messages and replies are ingested through verified, idempotent webhooks into a shop-scoped inbox.

Users with permission may:

- View, filter, assign, tag, and close threads.
- Link/unlink a Customer or Order.
- Add internal notes that can never enter the send pipeline.
- Reply only when provider capability, template/window, permission, and purpose rules permit.

Provider display name alone does not auto-match a Customer.

## 17. Marketing consent and analytics

### 17.1 Marketing consent

The initial public UI uses one optional unchecked WhatsApp-only checkbox naming the shop and purpose. Messenger or another direct-marketing channel is added only after separate enablement and legal/provider approval and requires a new affirmative action. Facebook Page publishing is not customer direct marketing.

Backend evidence is stored separately for every named channel under one evidence group. Adding Instagram or another channel later requires a new statement and affirmative action; old consent does not silently expand.

Transactional messaging has a separate purpose and must not contain promotional content.

### 17.2 Form-abandonment analytics

Analytics preference is separate from marketing consent.

For eligible sessions only, first-party pseudonymous events may include:

- Product/order-page view.
- Form started.
- Allowed non-PII progress event.
- Submit attempted.
- Submit succeeded.

No name, address, contact detail, notes, validation value, or free-text form content is captured.

Abandonment is derived when an eligible session emitted `FORM_STARTED` but no successful submit before configured expiry. Reports show analytics-eligible coverage and never treat non-consenting visitors as abandoned.

Operational order funnel data remains authoritative and separate from analytics sessions.

## 18. Offline/PWA decision

### 18.1 MVP decision

Offline public order submission, offline status mutation, and offline Picking Entry synchronization are **not approved MVP requirements**.

They may be evaluated later through a separate threat model, UX design, conflict policy, privacy assessment, and acceptance criteria.

### 18.2 Safe optional web-app behavior

The implementation may provide normal responsive/mobile web behavior and may later add installation metadata. If a limited PWA cache is introduced, it must obey these rules:

- Cached catalog/content may be shown with an explicit stale/offline indicator and cache timestamp.
- Cached availability must never be represented as current.
- Offline customer input may be saved only as a local **draft**, not an Order.
- No order reference, capacity claim, or success receipt is produced before server commit.
- On reconnection the server revalidates price, package, date, capacity, delivery, and consent; changed commercial values require customer review.
- Tenant, user, shop-switch, logout, expiry, shared-device, and suspension cache behavior must be specified and tested.
- Personal or operational data is minimized and never placed in generic caches/logs.

An in-app installation prompt is capability-dependent. Platforms without a programmable prompt use accessible installation guidance. Installation is never required to place an order.

## 19. Technology-neutral architecture

### 19.1 Recommended shape

A modular monolith is appropriate for MVP:

```text
Tenant-resolved public shops
Shop portal
Platform Admin console
        ↓
Application/API and domain services
        ↓
Transactional relational database
Object/media storage and processing
Durable job/outbox worker
PDF renderer
Channel-provider adapters/webhooks
Operational email provider
Observability, secrets, and backups
```

Domain modules include:

- Tenancy and entitlements.
- IAM and memberships.
- Catalog, packages, media, and CMS.
- Availability, orders, sources, customers, and fulfillment.
- Suppliers, quality, purchases, expenses, picking, and finance.
- Reporting, analytics, exports, invoices, and order documents.
- Reviews, picker applications, and contact messages.
- Channels, campaigns, segments, shared inbox, and notifications.
- Settings and audit.

### 19.2 Technology selection

The requirements are technology-neutral. TypeScript, React/server rendering, PostgreSQL, a PostgreSQL-backed job queue, and Vitest are reasonable implementation recommendations but are not approved business or architecture requirements until the engineering team records the decision.

Equivalent technologies are acceptable if they preserve transactions, tenant isolation, durable jobs, accessibility, security, localization, audit, provider abstraction, and testing requirements.

### 19.3 Core data relationships

```text
Platform
└── Shop/Tenant
    ├── Memberships → Users/Roles/Permissions
    ├── CMS → Revisions/Media
    ├── Products → Packages/Media/Availability
    ├── Customers → Addresses/Consent/Orders
    ├── Orders → Items/Snapshots/Status History/Payments/Documents
    ├── Suppliers → Quality Rates/External Purchases
    ├── Staff → Picking Entries/Earnings
    ├── Expenses → Allocations/Attachments
    └── Channels → Connections/Campaigns/Segments/Inbox
```

Shop-owned foreign keys are tenant-consistent. Commercial, customer, fulfillment, source, quality/rate, consent, and document facts are snapshotted where later edits must not rewrite history. Detailed entities, constraints, and deletion behavior are defined in [07 — Data Model](07-data-model.md).

## 20. Security, privacy, accessibility, and reliability

### 20.1 Security

- MFA required for every human Platform Admin, Manager, Staff, and Content Editor account; service identities use separate non-interactive controls.
- Server-side permission and object/tenant checks for every protected action.
- Manager receives all shop permissions; Platform Admin inherits them in selected-shop context plus platform permissions. Domain/tenant/history invariants still apply.
- Tenant isolation across API, database/query, cache, media, jobs, exports, analytics, webhooks, logs, and provider connections.
- CSRF, XSS, injection, mass assignment, file-upload, enumeration, and rate-limit protections.
- Encrypted provider credentials and sensitive data controls.
- Tamper-resistant platform/shop audit records.

Any cross-tenant data disclosure is release-blocking.

### 20.2 Privacy

- Purpose limitation, minimization, retention, anonymization, and data-subject workflows.
- Marketing consent optional, unselected, informed, channel-specific in evidence, and withdrawable.
- Analytics preference separate from marketing.
- No production customer data in lower environments without approved anonymization.
- Shared-inbox, attachments, segments, suppressions, consent, and provider identifiers have purpose-based access and retention.

### 20.3 Accessibility and localization

- Critical public/shop flows target WCAG 2.2 AA.
- Keyboard, focus, labels, errors, contrast, reflow, screen-reader semantics, and reduced-motion behavior.
- Shop-localized UI/content/messages/documents and Unicode-capable PDF fonts.
- Currency/date/time/phone/address presentation follows locale while stored values remain canonical.

### 20.4 Reliability

- Atomic and durable order/capacity transaction.
- Durable idempotent scheduler, notification, export, PDF, channel-send, and webhook handling.
- Encrypted backups with restoration rehearsal.
- Provider failure does not corrupt an order transaction.
- Financial aggregates reconcile to source transactions.

## 21. Testing strategy

### 21.1 Unit/property tests

- Capacity arithmetic and invariant properties.
- Fixed public quantity 1, with package size as the public volume choice; positive integer quantity remains available to authorized manual/historical entry.
- Customer normalization/matching and area derivation.
- Order state machine and required transition evidence.
- Delivery fee/threshold and manual-agreement logic.
- Shop-timezone scheduler and DST boundaries.
- Quality-grade/effective buy-rate resolution.
- Staff compensation and expense allocation.
- Financial recognition, refund timing, and profit formulas.
- Consent/current-state and segment eligibility.
- Analytics abandonment derivation without PII.

### 21.2 Database/integration tests

- Concurrent final-capacity reservation.
- Transaction rollback and idempotency.
- Capacity movement reconciliation.
- Cross-tenant isolation across every storage/access boundary.
- Membership/role and last-Manager/Platform-Admin protections.
- Historical-order reporting without past-capacity mutation.
- Durable scheduler recovery and duplicate delivery.
- Outbox/provider outage/retry.
- Webhook signature, tenant routing, duplicate/reordered callbacks.
- Scheduled per-recipient campaign idempotency and consent recheck.
- Financial aggregate/source reconciliation.
- Manual sold-out versus natural exhaustion, order blocking, concurrency, clearing behavior, and proof that no sales/finance/fulfillment fact is fabricated.
- Invoice/Order Summary snapshot and Unicode rendering.
- Product video file/embed validation and tenant quotas.

### 21.3 API/contract tests

- Stable validation/error codes.
- Client validation bypass and mass assignment.
- Expected version/status conflicts.
- Horizontal/vertical and cross-tenant access.
- Provider capabilities and failure normalization.
- Export/download authorization and expiry.

### 21.4 Browser/E2E and accessibility

- Public order paths, positive remaining display, natural/manual sold-out banner/date disabling, capacity race recovery, fixed public quantity, and manual multi-quantity behavior.
- Customer creation/matching/profile navigation.
- Manager/Staff inline status flows.
- Historical order entry and report inclusion.
- CMS/media and review moderation.
- Shop provisioning/context switching/suspension.
- Channel connection, scheduled Page post, Group manual share, WhatsApp campaign, opt-out, and shared inbox.
- Analytics off/on and abandonment coverage.
- Keyboard, screen-reader, mobile, both initial locales, and supported browsers.

The specific runner—Vitest or equivalent—is an implementation decision. Test coverage and risk scenarios are requirements; the brand of runner is not.

## 22. Open implementation decisions

The following remain intentionally unresolved and must be approved before their related release:

- Exact same-day cutoff; 14:00 is only a proposal.
- Final initial product/package/pricing catalog.
- Delivery postal zones and confirmation of initial 20 L/€3 seed values.
- Pickup locations and weekday/date exceptions.
- VAT/tax and legal invoice fields, numbering, terms, and correction/credit-note policy.
- Purpose-specific data and message retention periods.
- Analytics preference/cookie wording, retention, and session expiry.
- Uploaded-video quotas, formats, limits, and processing policy.
- Meta/BSP choice, app verification, scopes, templates, rate/frequency caps, and onboarding.
- Allowed segment fields and marketing frequency policy.
- Consumer terms, seller/pre-contract disclosures, contract-formation wording, withdrawal/cancellation rules, and perishable-goods treatment.
- Operating-company microenterprise status and resulting Finnish accessibility-statement/service obligations; WCAG 2.2 AA remains required regardless.
- Platform subscription plans, prices, billing provider, entitlements, tax, dunning, cancellation, and self-service onboarding.
- Final test runner and named infrastructure/provider products. The approved baseline is TypeScript/Next.js modular monolith, PostgreSQL, PostgreSQL-backed jobs/outbox, managed OIDC/MFA, EU object storage, and server-side PDF rendering.

## 23. Release principles

- No cross-tenant disclosure.
- No reproducible oversell or duplicate-order effect.
- No public order success before server commit.
- No automatic `READY` transition.
- No marketing send without current exact shop/channel eligibility.
- Manager/Platform Admin self-approval is allowed and every financial workflow step remains separately audited.
- Manual sold-out never fabricates or alters order, litre, fulfillment, revenue, expense, or payment truth.
- No silent rewriting of historical order, financial, consent, document, or provider evidence.
- No misleading financial total when reconciliation fails.
- No claim that unsupported Facebook Group automation exists.
- No claim that analytics abandonment covers non-consenting traffic.
