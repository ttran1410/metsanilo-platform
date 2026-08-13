# 02 — Functional Requirements

> **v0.0.1 scope override — ADR-0005 applies.** Implement the single-shop pilot only. `ADMIN` is the owner; `MANAGER`, `STAFF`, and `CONTENT_CREATOR` are shop users with feature-level permissions. `PLATFORM_ADMIN`, multi-shop provisioning, Facebook/WhatsApp, Google route services, postal zones, public picker applications, supplier/expense/quality/reporting modules, video media, and marketing automation are deferred even where their future IDs remain below.

All requirements in this document are MVP requirements unless marked otherwise.

## 1. Public website

- **FR-PUB-001:** The system shall provide public pages for Home, Order, How It Works, Reviews, Become a Picker, About Us, Contact, Privacy Notice, and required legal information.
- **FR-PUB-002:** The Home page shall show active products, active packages, prices, and configurable date-specific availability.
- **FR-PUB-003:** Public pages shall use Finnish as the initial shop default, be available in Finnish and English through an obvious accessible language switch, use deterministic localized routes, and retain an explicit locale choice during later navigation.
- **FR-PUB-004:** The Home page shall link directly to an Order form, preselecting product/package/date when the CTA supplies them.
- **FR-PUB-005:** When a product/date is open with positive remaining capacity, public product/order views shall show the exact remaining litres. When remaining capacity is zero or a manual sold-out override is active, they shall show the localized banner/state `Loppuunmyyty` (Finnish) or `Sold out` (English), hide the numeric remaining amount, and disable that order date. The label shall come from i18n resources, not hard-coded component text.
- **FR-PUB-006:** Public pages shall use only published CMS content and published reviews.
- **FR-PUB-007:** The customer shall see an on-screen receipt after successful order submission, including public order reference and a statement that staff confirmation is pending.
- **FR-PUB-008:** The website shall not require or offer a customer account in MVP.

## 2. Orders

- **FR-ORD-001:** A public submission shall atomically create an order in `NEW`, create/match or provisionally associate a customer under the conflict rules, store order/customer snapshots, reserve capacity, and write an audit event.
- **FR-ORD-002:** Manager and permitted Staff shall create orders received through the website, phone, or other manually recorded sources; no Facebook/WhatsApp connector is required.
- **FR-ORD-003:** Manager/permitted Staff shall create a normal manual order in `NEW` or `CONFIRMED`.
- **FR-ORD-004:** Manager/permitted Staff shall record a historical order in an appropriate terminal outcome, subject to required evidence fields, source, actual dates, payment facts where applicable, and audit reason. A historical refund shall preserve the completed-sale event followed by the refund event rather than creating an unexplained bare refund.
- **FR-ORD-005:** Authorized users shall search and filter orders by reference, customer, phone, status, fulfillment date/method, product, source, payment state, and overdue state.
- **FR-ORD-006:** Authorized users shall view order details, customer snapshot, items, totals, fulfillment information, payment record, notes, status history, capacity effects, and audit history.
- **FR-ORD-007:** Authorized users shall change status only through permitted transitions.
- **FR-ORD-008:** Order edits that change product, package, quantity, or fulfillment date shall revalidate and atomically rebalance capacity.
- **FR-ORD-009:** Cancellation shall require a reason. From `NEW`/`CONFIRMED` it releases reserved capacity exactly once; from `PICKING`, `READY`, or `OUT_FOR_DELIVERY` it records consumed/waste capacity and shall not automatically reopen availability.
- **FR-ORD-010:** Staff shall be able to record contact attempts and notes without changing customer-visible data.
- **FR-ORD-011:** The system shall prevent duplicate order creation caused by repeat submission/retry through an idempotency mechanism.
- **FR-ORD-012:** Order records shall support payment methods `CASH`, `BANK_TRANSFER`, `MOBILEPAY`, and extensible future values, plus a separate payment status.
- **FR-ORD-013:** No order-status transition shall automatically message a customer in MVP. An authorized user may explicitly send a compliant transactional message through the channel module.
- **FR-ORD-014:** Manager/permitted Staff shall bulk mark eligible `PICKING` orders as `READY`, with confirmation and audit.
- **FR-ORD-015:** Authorized users shall generate and download a versioned invoice PDF for an eligible order without automatically emailing it to the customer.
- **FR-ORD-016:** Authorized shop users shall generate and download a localized Order Summary/Confirmation PDF independently of an invoice PDF.
- **FR-ORD-017:** Public order fulfillment dates shall never be in the past in the shop timezone; Manager/permitted Staff may record past orders only through the historical-order workflow.
- **FR-ORD-018:** The order list shall allow permission-aware inline initiation of valid status transitions and shall open a dialog whenever the transition requires evidence, reason, payment, delivery, or consequence confirmation.

## 3. Customers

- **FR-CUS-001:** The system shall create or match a customer during creation, preferring normalized primary mobile, then normalized email; connector-specific identifiers are deferred.
- **FR-CUS-002:** Ambiguous or conflicting matches shall never be automatically linked or merged. A public order shall use a new provisional customer record flagged for staff resolution; Manager/permitted Staff shall later select/create the canonical customer without rewriting the submitted order snapshot.
- **FR-CUS-003:** Manager/permitted Staff shall create, view, update, and search customers; anonymization requires Manager or a dedicated permission.
- **FR-CUS-004:** Customer details shall show order history, total order count, gross spend, latest activity, contact details, addresses, preferences, and internal notes.
- **FR-CUS-005:** Each order shall preserve immutable-at-fulfillment snapshots of customer identity, contact, and delivery address.
- **FR-CUS-006:** Anonymization shall preserve legally/operationally required order facts while removing or replacing direct identifiers.
- **FR-CUS-007:** Marketing consent and withdrawal shall be recorded independently of order-processing data.
- **FR-CUS-008:** Customer profiles shall support primary mobile, WhatsApp number, Messenger/Facebook display name, stable provider identifier where available, preferred contact channel, and optional customer area.
- **FR-CUS-009:** The system shall derive customer area from an address/postal-zone mapping when possible, store derivation source/confidence, and permit an authorized manual override.
- **FR-CUS-010:** Customer profiles shall show order/completion counts, revenue/lifetime summary, latest activity, and a link to the shop-scoped Orders page filtered by immutable customer ID.
- **FR-CUS-011:** Order lists/details shall link to the matched customer profile and support opening it in a separate browser tab.

## 4. Products, packages, and availability

- **FR-PRD-001:** Admin, Manager, Staff, and Content Creator may create, view, update, activate, archive, localize, and—when unreferenced and explicitly permitted—delete products in the single shop.
- **FR-PRD-002:** Admin, Manager, and Staff with `catalog.package.write` shall manage fixed package options with litre amount, EUR price, localized name, display order, active period/state, and public quantity behavior. Content Creator may view package facts but shall not change price or capacity controls unless explicitly assigned.
- **FR-PRD-003:** Historical orders shall retain item name, package litres, unit price, tax representation if applicable, and totals even after product/package changes.
- **FR-PRD-004:** A product or package referenced by any retained business/history record shall be archived/deactivated rather than hard-deleted. Hard deletion is allowed only after server-side proof that the record is unreferenced within its shop.
- **FR-MED-001:** A product/page shall support an ordered gallery of at most four images. Video uploads, external video references, and raw embeds are deferred.
- **FR-MED-002:** Each product gallery shall support one primary item, localized captions/accessibility text, active/archive state, media metadata, and safe preview/reordering.
- **FR-MED-003:** The product-management UX shall enforce the four-image maximum, image type/size checks, alternative text, preview, reorder, and archive behavior.
- **FR-PRD-005:** Public MVP ordering shall use exactly one package per order line and a fixed quantity of 1; package size provides the customer-visible volume choice. Manager/permitted Staff manual and historical orders may use a positive integer quantity subject to capacity and evidence rules.
- **FR-PRD-006:** The public quantity control shall be absent and the server shall reject any submitted quantity other than 1; it shall never silently normalize manipulated input.
- **FR-PRD-007:** Each publicly orderable product shall have required inclusive `available_from` and `available_through` business dates in the shop timezone; permitted Product-module roles may set or extend the window, subject to protected-history and availability rules.
- **FR-AVL-001:** Admin, Manager, and Staff with `availability.write` shall configure per-product, per-date capacity in litres and whether orders are accepted for today and future in-window dates. The current business date shall remain editable, including after the order cutoff; cutoff controls order acceptance, not capacity administration.
- **FR-AVL-002:** The system shall calculate reserved and remaining litres from capacity and capacity-holding orders.
- **FR-AVL-003:** Capacity validation and reservation shall be atomic and safe under concurrent submissions.
- **FR-AVL-004:** Admin, Manager, and Staff with `availability.write` may increase capacity for today or a future in-window date and may reduce it only to a value not below reserved litres. Existing reservations must be released or corrected through their valid workflows before a lower capacity can be saved; no role may force capacity below reserved litres.
- **FR-AVL-005:** Availability shall support global defaults and date-specific overrides for opening, cutoff, pickup time, and operational timing.
- **FR-AVL-006:** The availability planner shall support single-day, ISO-week, calendar-month, and custom-date-range batch entry, normalized to canonical per-product/per-date availability rows.
- **FR-AVL-007:** Availability creation/update and live/manual order validation shall reject dates outside the product's inclusive availability window. A batch containing any invalid date shall fail atomically without clipping or partial writes.
- **FR-AVL-008:** Admin, Manager, and Staff with `availability.sold_out` shall set/clear a per-product/per-date manual sold-out override with an internal audited reason. It blocks new public/live manual orders without changing existing reservations or transactional facts.
- **FR-SRC-001:** Managers shall configure shop-specific order sources with stable code, localized label, category/channel, active/archive state, and display order.
- **FR-SRC-002:** Public website orders shall receive the configured website source automatically; manual/historical orders require an active source selection.
- **FR-SRC-003:** Order-source records referenced by history shall be archived rather than deleted, and orders shall snapshot source label/code.
- **FR-SRC-004:** Orders shall optionally store campaign/referrer attribution identifiers for future sales-attribution reporting. MVP campaign operations may show send/delivery results, but campaign-to-sales report UI is outside MVP.

## 5. Pickup and delivery

- **FR-DLV-001:** Admin, Manager, and Staff with `delivery.configure` shall create/update/archive pickup locations with a complete customer-visible address, localized instructions, active dates, and time slots. The selected address/instructions shall appear during pickup ordering, review, and the successful-submission message.
- **FR-DLV-002:** The default pickup time shall be configurable, initially 20:00, with weekday and specific-date overrides.
- **FR-DLV-003:** Admin, Manager, and Staff with `delivery.configure` shall maintain customer-visible delivery details and delivery-origin/address text. No distance, postal-zone, route, provider, or enable/disable setting exists in v0.0.1.
- **FR-DLV-004:** Every delivery order shall display `Delivery to be agreed`; the system shall not call Google or any routing provider.
- **FR-DLV-005:** Until an authorized user agrees a fee, delivery fee and final order total remain pending while item subtotal remains authoritative.
- **FR-DLV-006:** Admin, Manager, and Staff with `delivery.override` shall enter an agreed non-negative delivery fee and reason, with actor and timestamp audit.
- **FR-DLV-007:** Pickup orders shall not require delivery address fields; delivery orders shall.
- **FR-DLV-008:** The order shall snapshot customer delivery details, agreed fee (if any), actor/reason/timestamp, and pickup address where applicable; route distance, provider outcome, and Google quote fields are deferred.

## 6. CMS and public content

- **FR-CMS-001:** Admin, Manager, Staff, and Content Creator with `cms.edit` shall manage fixed public pages/sections including shop description, pickup instructions, product names/descriptions, Home, How It Works, About, Contact, and footer.
- **FR-CMS-002:** CMS content shall support Finnish and English variants, draft/published state, preview, revision history, and at most four images per page/product with alternative text.
- **FR-CMS-003:** Publishing shall validate required content for each supported locale or explicitly allow a documented fallback.
- **FR-CMS-004:** Products, availability, reviews, orders, and other operational data shall not be editable as unstructured CMS content.
- **FR-CMS-005:** Authorized users shall be able to restore or republish a prior content revision.

## 7. Reviews

- **FR-REV-001:** A customer shall be able to submit a public review without an account.
- **FR-REV-002:** Public submissions shall enter `PENDING` and remain invisible until approved.
- **FR-REV-003:** Manager/permitted Staff shall add reviews manually and approve, reject, hide, edit presentation text, or archive reviews.
- **FR-REV-004:** The original submitted review content shall remain immutable and auditable when display content is edited.
- **FR-REV-005:** Only approved and published reviews shall appear publicly; selected/featured reviews may appear on Home.

## 8. Picker applications and messages

- **FR-PIC-001:** Authorized Admin, Manager, or Staff with `pickers.manage` shall create and maintain a record-only external picker (name, contact, active state, and note).
- **FR-PIC-002:** A picker record shall not create a login, supplier payment profile, or public application workflow.
- **FR-PIC-003:** Authorized users shall create a picking record linking a picker record or staff member, product, picking date, quantity, unit (`LITRE` or `KILOGRAM`), buy price per selected unit, and calculated total. A record has exactly one unit; customer orders and capacity remain litres-only.
- **FR-PIC-004:** Picker output/payment calculation and public picker applications are deferred.
- **FR-MSG-001:** The public Contact page shall store a categorized message with status `NEW`.
- **FR-MSG-002:** Manager/permitted Staff shall search, view, assign, note, and transition contact messages through `NEW`, `READ`, `REPLIED`, and `CLOSED`.
- **FR-MSG-003:** Replies are recorded as an operational note/link in MVP; the platform is not required to send the customer reply.

## 9. Identity, permissions, settings, dashboard, and notifications

- **FR-IAM-001:** Admin and Manager shall invite/activate/suspend users in the single shop. Manager may manage Staff and Content Creator assignments.
- **FR-IAM-002:** The system shall provide `ADMIN`, `MANAGER`, `STAFF`, and `CONTENT_CREATOR` roles with feature-level permissions and MFA for every human portal user.
- **FR-IAM-003:** Admin and Manager shall assign/revoke feature permissions for Staff and Content Creator without granting Admin.
- **FR-IAM-004:** Authentication, authorization, and important account activity shall be audited.
- **FR-IAM-005:** Admin and Manager have every shop permission, including financial self-approval. Staff may approve or mark paid only when explicitly assigned the relevant feature permission. Domain/data invariants remain mandatory for every role.
- **FR-SET-001:** Admin and Manager shall configure single-shop business details, locales, contact channels, operational times, cutoff, delivery/pickup, and notifications; Staff may update only explicitly assigned operational settings. Availability presentation shall remain consistent with FR-PUB-005 and is not a shop-configurable disclosure mode.
- **FR-DSH-001:** The dashboard shall show today’s order counts/volume/value by status, remaining capacity, overdue `NEW`/`PICKING` orders, and upcoming fulfillment workload.
- **FR-DSH-002:** Dashboard figures shall link to the corresponding filtered operational list.
- **FR-NTF-001:** The system shall create in-app notifications for new orders, contact messages, and picker applications.
- **FR-NTF-002:** If a `NEW` order remains unresolved for 15 minutes, the system shall create one initial overdue reminder and mark it overdue; transition to `CONFIRMED`, `CUSTOMER_DECLINED`, or `CANCELLED` resolves it.
- **FR-NTF-003:** At the configured ready-review time, initially 19:00, the system shall notify staff of today’s orders still in `PICKING`; it shall not automatically mark them `READY`.
- **FR-NTF-004:** Each eligible portal user shall configure email delivery by notification category; in-app notifications remain authoritative.
- **FR-NTF-005:** Notification jobs shall be idempotent, retryable, and auditable.

## 10. Suppliers, costs, staff earnings, reporting, and invoices

> **Pilot boundary:** implement only basic order payment records, invoice PDF generation/download, record-only picker records, and picking records in litres or kilograms with unit-specific buy prices. `FR-SUP-*`, `FR-QLT-*`, broad `FR-FIN-*`, and `FR-RPT-*` workflows below are future roadmap requirements. Admin/Manager self-approval is allowed; Staff requires explicit permission.

- **FR-SUP-001:** Manager/permitted Staff shall create, view, update, archive, and search shop Supplier profiles independently of customers, users, and picker applicants.
- **FR-SUP-002:** Manager and permitted Staff shall record external berry purchases by supplier, product, purchase/picking date, litres, price per litre or total, payment status, receipt/reference, and notes. Purchases follow `DRAFT → SUBMITTED → APPROVED → PAID` with rejection/correction controls. Manager or Platform Admin in selected-shop context may perform every workflow action, including approving a record they created/submitted.
- **FR-SUP-003:** Supplier records referenced by purchases shall be archived rather than hard-deleted; purchase snapshots shall preserve historical supplier/product/pricing facts.
- **FR-QLT-001:** Manager and Staff explicitly granted `quality.configure` shall configure shop-scoped external-purchase quality grades with stable code, localized name/condition, ranking/display order, and active/archive state. Staff is denied this permission by default.
- **FR-QLT-002:** Manager/permitted Staff shall configure effective-dated external buy rates by product and quality grade, with optional supplier-specific override.
- **FR-QLT-003:** Each external purchase line shall record exactly one quality grade and snapshot the applied condition/rate; multiple grades for one supplier/product/date are represented as separate lines.
- **FR-QLT-004:** The quality model shall allow future use by staff picking or customer-facing product quality without enabling those uses in MVP.
- **FR-FIN-001:** Manager and permitted Staff shall record expenses with date, category, supplier/payee, amount, future VAT representation, allocation method, payment status, receipt, and notes.
- **FR-FIN-002:** Expense categories shall initially include packaging/buckets, external berry purchase, fuel/delivery, equipment, staff picking earnings, and other, while remaining configurable.
- **FR-FIN-003:** An expense shall support `ONE_TIME`, `RECURRING`, and manually allocated reporting treatment across an explicit date range; MVP is management reporting, not a statutory depreciation engine.
- **FR-FIN-004:** Manager/Staff shall record shop Picking Entries by staff, product, picking date, litres and compensation method `PER_LITRE`, `PER_HOUR`, `FIXED`, or manual adjustment.
- **FR-FIN-005:** Compensation rates shall support staff-, product-, method-, and effective-date-specific values while each approved entry snapshots the applied rate and calculated earning.
- **FR-FIN-006:** Picking Entries shall follow `DRAFT → SUBMITTED → APPROVED → PAID` with correction/rejection controls and audit history. Manager or Platform Admin in selected-shop context may perform every workflow action.
- **FR-FIN-007:** Manager may create, submit, approve, reject, correct, and mark paid their own Picking Entry, expense, or external purchase. Platform Admin inherits the same authority in explicit selected-shop context. Every action and role/context is audited.
- **FR-FIN-008:** Staff shall be able to view their own picking volume, earning entries, approval/payment states, and period totals, but not another staff member’s earnings unless granted a finance permission.
- **FR-RPT-001:** Authorized users shall view weekly, custom date-range, monthly, product, staff, fulfillment-method, and order-source reports using the business timezone.
- **FR-RPT-002:** Financial reporting shall show gross recognized revenue, refunds, net revenue, non-staff operating costs, operating result before staff picking cost, staff picking cost, and estimated operating profit after staff picking cost.
- **FR-RPT-003:** Reports shall include order count/value, litres/revenue by product, pickup versus delivery, delivery fee and fuel cost, external purchase volume/cost, staff picking volume/earnings, capacity utilization, natural/manual sold-out periods as non-transactional operational facts, average order value, new/repeat customers, order outcomes, and confirmation time.
- **FR-RPT-004:** Reports shall support CSV and PDF export with applied filters, generation timestamp, timezone, currency, formula definitions, and data-as-of information.
- **FR-RPT-005:** Exported reports shall enforce the same permissions and staff-income privacy rules as on-screen reports.
- **FR-RPT-006:** Report calculations shall be reproducible from immutable/snapshotted source transactions and display late adjustments/refunds in the period in which they are recognized.
- **FR-INV-001:** An invoice record shall design for seller, customer/order, line items, delivery fee, totals, currency, future VAT/tax fields, payment terms/status, issue/due date, and invoice number/version; VAT/tax fields remain hidden from MVP UI/PDF until enabled by approved shop configuration.
- **FR-INV-002:** Invoice numbering shall be unique and configurable, and issued invoice versions shall remain auditable; corrections shall not silently rewrite an issued document.
- **FR-INV-003:** Invoice PDF shall be available to authorized shop users and may be provided manually to the customer outside the platform.
- **FR-INV-004:** Invoice generation shall expose an integration boundary for future customer email delivery without implementing automatic sending in MVP.

## 11. Multi-tenant platform, analytics, and channel integrations

> **Deferred for v0.0.1:** the pilot has one shop and no Platform Admin, tenant provisioning, cross-shop context, Facebook/WhatsApp connector, shared inbox, or marketing automation. Keep these IDs for future traceability only.

- **FR-TEN-001:** Every shop-owned record and operation shall be associated with exactly one tenant/shop and protected by server-side tenant isolation.
- **FR-TEN-002:** Platform Admin shall manually provision, configure, suspend/reactivate, and audit shops in MVP.
- **FR-TEN-003:** A shop shall own its identity/branding, locale/timezone/currency defaults, public host/slug, users/roles, content, catalog, operations, finance, customers, reports, integrations, and settings.
- **FR-TEN-004:** Managers shall manage assigned shop users and shop roles/permissions but shall not access other shops or platform security/subscription controls.
- **FR-TEN-005:** A user may be a member of multiple shops with separate roles and shall explicitly operate within a selected shop context.
- **FR-TEN-006:** Platform Admin shall explicitly select a target shop before exercising inherited Manager actions. The visible selected-shop context, actor, and actions are audited; inside that context Platform Admin has the full Manager permission set.
- **FR-TEN-007:** MVP shall expose subscription-plan/status data structures and entitlement checks for future use but shall not implement automated subscription signup, billing, trials, or dunning.
- **FR-ANA-001:** The public site shall record privacy-eligible funnel events for product/order page view, form start, form validation progress where approved, submit attempt, submit success, and abandonment derivation.
- **FR-ANA-002:** Form-abandonment tracking shall be first-party, pseudonymous, tenant-scoped, free of entered field values/PII, bounded by analytics preference/consent, and retained for a configured period.
- **FR-ANA-003:** Funnel reports shall distinguish analytics-session conversion from operational order conversion and disclose excluded/non-consenting traffic.
- **FR-ANA-004:** Operational funnel shall report submitted, `CUSTOMER_DECLINED`, confirmed, `CANCELLED_BY_CUSTOMER`, other cancelled, pickup/delivery completed, rejected, no-show, and refunded outcomes with reason dimensions.
- **FR-CHN-001:** Managers shall connect/disconnect shop-specific provider accounts through a provider-neutral channel interface; credentials/tokens shall be encrypted, restricted, and health/expiry monitored.
- **FR-CHN-002:** MVP shall support Facebook Page publishing, Facebook Group manual-share preparation, and WhatsApp Business messaging; capability discovery shall prevent unsupported actions.
- **FR-CHN-003:** Authorized users shall create localized channel content drafts with text/media/link, target channels/audiences, schedule, approval/status, provider results, and audit.
- **FR-CHN-004:** Authorized users with send permission shall send transactional and marketing WhatsApp messages subject to provider window/template, consent, segmentation, frequency, and opt-out rules.
- **FR-CHN-005:** The system shall ingest supported Facebook/WhatsApp inbound messages/replies through verified webhooks into a shop-scoped shared inbox and associate/create channel contacts/customers only under matching rules.
- **FR-CHN-006:** Shared inbox users shall view threads, assign owner, tag, mark read/open/pending/closed, reply when permitted, link an order/customer, and see delivery/read/failure states exposed by provider.
- **FR-CHN-007:** Managers shall build reusable customer segments from permission-safe criteria and preview audience count/exclusions before scheduling a broadcast.
- **FR-CHN-008:** The initial public marketing checkbox shall cover WhatsApp only. A later approved statement may cover explicitly listed enabled channels, but evidence shall snapshot each channel separately and every newly introduced channel shall require a new affirmative action.
- **FR-CHN-009:** Scheduled publication/message dispatch shall be durable, idempotent, cancelable before dispatch, timezone-aware, rate-aware, and auditable.
- **FR-CHN-010:** The channel model shall support future Instagram and future Facebook Group auto-publishing capability without claiming that unsupported provider functions exist in MVP.
