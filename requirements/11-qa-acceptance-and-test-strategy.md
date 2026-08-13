# 11 — QA Acceptance Criteria and Test Strategy

## 1. Release acceptance scenarios

### Ordering and capacity

- **AC-ORD-001:** Given 20 L remains and the customer selects one 5 L package, when the customer submits the public order, then one `NEW` order for 5 L is created, remaining capacity becomes 15 L, snapshots/audit exist, and staff notification is queued.
- **AC-ORD-002:** Given only 5 L remains, when two concurrent customers each submit a 5 L order, then exactly one succeeds, one receives `CAPACITY_CHANGED`, and remaining capacity is 0—not negative.
- **AC-ORD-003:** Replaying a successful submission with the same idempotency key returns the same public reference and creates no second order/capacity movement/notification.
- **AC-ORD-004:** A public order is shown as pending confirmation; its initial status is never automatically `CONFIRMED`.
- **AC-ORD-005:** Cancelling a `NEW` or `CONFIRMED` order releases its reservation exactly once; replaying cancellation has no additional capacity effect.
- **AC-ORD-006:** Cancelling after `PICKING` requires a warning/reason. `REJECTED`, `NO_SHOW`, and `REFUNDED` do not restore past capacity.
- **AC-ORD-007:** Editing item/date atomically secures new capacity; if unavailable, the original order and reservation remain unchanged.
- **AC-ORD-008:** Staff can create a WhatsApp order as `CONFIRMED`; customer/customer snapshots, source, agreement data, capacity, audit, and totals are correct.
- **AC-ORD-009:** Staff can record a completed historical pickup/delivery only with fulfillment/payment/reason fields; live availability is unchanged and audit marks historical entry.
- **AC-ORD-010:** Public date selection rejects any past date in the resolved shop timezone; a valid historical order uses a past outcome/fulfillment date, changes no availability, and appears in that business period’s reports.
- **AC-ORD-011:** Public ordering exposes no quantity control and the server rejects a manipulated non-1 quantity with no order/capacity effect; a permitted manual order may use a positive integer quantity.
- **AC-ORD-012:** `NEW → CUSTOMER_DECLINED` and pre-picking post-confirmation `→ CANCELLED_BY_CUSTOMER` require appropriate reason, release capacity once, and remain separately reportable from business `CANCELLED`; cancellation after picking starts follows AC-ORD-018.
- **AC-ORD-013:** Inline status change shows only permitted actions, collects required fields in a dialog, and a stale/concurrent update creates no partial transition.
- **AC-ORD-014:** Order list/detail opens the correct same-shop customer profile in a new tab; “View all orders” uses customer ID filter and excludes other customers/shops.
- **AC-ORD-015:** When public phone/WhatsApp and email/provider identifiers conflict across existing customers, the order is created once with a provisional customer flagged for review; neither existing customer is auto-linked/merged and the submitted snapshot remains immutable after resolution.
- **AC-ORD-016:** An outside/unverifiable delivery order stores an authoritative item subtotal but null/pending delivery fee and final total; confirmation is blocked until agreement records the fee and final total.
- **AC-ORD-017:** A partial refund leaves fulfillment status completed and sets payment summary `PARTIALLY_REFUNDED`; only full cumulative refund transitions to `REFUNDED`, and cumulative refunds cannot exceed the refundable amount.
- **AC-ORD-018:** Cancellation from `NEW`/`CONFIRMED` releases capacity once, while cancellation from `PICKING`, `READY`, or `OUT_FOR_DELIVERY` records consumed/waste litres and does not reopen availability.
- **AC-ORD-019:** Public ordering creates a pending reservation request; the sales-contract event is recorded only on staff confirmation, both locales make that timing prominent before submit and on receipt, the customer cannot bypass the applicable terms/disclosures, and no charge occurs before confirmation.

### Product and availability

- **AC-PRD-001:** In an explicitly selected active shop, Platform Admin, Manager, Staff, and Content Editor can create/update/localize/archive a product and delete it only while unreferenced; direct or cross-shop calls are denied. Content Editor cannot change package price or per-date capacity.
- **AC-PRD-002:** Given a product window of 2026-06-15 through 2026-08-31, authorized capacity planning for today or a future valid day, ISO week, calendar month, or custom range creates/updates exactly the intended per-date rows. Today's capacity remains editable after cutoff but cannot be reduced below reserved litres and does not reopen ordering by itself. A request containing a historical date or 2026-09-01 is rejected atomically with no partial change.
- **AC-PRD-003:** Shortening a product window across an order, reservation, Picking Entry, external purchase, or other retained dated fact is rejected. Future unreserved availability outside the proposed window can be removed only through explicit confirmed adjustment, after which the window change succeeds and remains audited.
- **AC-AVL-001:** Platform Admin, Manager, and Staff can set/clear manual sold-out for an in-window product/date with internal reason/audit. Once set, new public/live-manual orders are rejected, existing reservations remain unchanged, and clearing it restores the correctly derived current state.
- **AC-AVL-002:** Positive open capacity displays exact remaining litres. Natural zero remaining or manual sold-out displays a localized “Sold out” banner, disables the date, hides numeric remaining capacity and internal cause, and rejects stale/racing submissions without partial effects.

### Fulfillment and automation

- **AC-AUT-001:** At Helsinki 10:00, today’s `CONFIRMED` orders become `PICKING`; tomorrow’s, yesterday’s, and non-confirmed orders do not.
- **AC-AUT-002:** A today order confirmed at 10:01 before cutoff enters `PICKING` immediately; one confirmed at 09:59 remains `CONFIRMED` until scheduler execution.
- **AC-AUT-003:** At 19:00, today’s remaining `PICKING` orders are marked overdue and generate deduplicated notification, but remain `PICKING`.
- **AC-AUT-004:** Missed/retried scheduler execution produces each transition/reminder once and never overwrites a newer human status.
- **AC-AUT-005:** The full pickup and delivery transition paths work; forbidden transitions return `INVALID_TRANSITION` without partial side effects.

### Delivery and payment

- **AC-DLV-001:** With platform/shop switches enabled and readiness satisfied, Platform Admin/Manager can enable Google quoting and Platform Admin/Manager/Staff can validate the origin/configure a 5,000 m maximum. Provider-returned distances of 5,000 m and 5,001 m classify inside/outside; inside, 20 L at a 20 L threshold receives €0 and 19 L receives €3. Straight-line/postal-zone/client values never override the server result.
- **AC-DLV-002:** With either switch disabled, no Google delivery request is emitted, existing unconsumed automatic quotes become stale, and a destination passing local format checks yields the public “to be agreed” fallback with internal `PROVIDER_DISABLED`. The same public fallback covers beyond-limit, ambiguous/unverifiable, no-route, timeout, quota, and provider errors while internal causes remain distinct. Reservation remains possible and confirmation waits for Staff to record agreed fee/details; retry/idempotency does not duplicate the order.
- **AC-DLV-003:** Platform Admin in selected-shop context, Manager, and Staff can manage pickup locations. Pickup hides/clears delivery fields, requires an active location/time slot, and shows the complete snapshotted pickup address/instructions during selection, review, and successful submission; delivery requires and snapshots the customer's full destination address.
- **AC-PAY-001:** Cash, bank transfer, and MobilePay may be recorded without an external transaction. `PAID` and refund states require their specified evidence.

### Customer and privacy

- **AC-CUS-001:** Existing same-shop customer matches by normalized primary-mobile/WhatsApp before email/stable Messenger provider ID; display name never auto-matches, conflicts require staff resolution, and no cross-shop match occurs.
- **AC-CUS-002:** Editing a customer profile does not change historical order snapshots.
- **AC-CUS-003:** Customer anonymization removes/replaces direct identifiers as policy permits but preserves non-identifying order and audit facts.
- **AC-PRV-001:** Marketing checkbox is visible, separate, optional, and unchecked; declining it never blocks order submission.
- **AC-PRV-002:** Grant and withdrawal create auditable consent events with statement version, locale, purpose, source, and timestamp.
- **AC-ACC-001:** The launch evidence records the operating company's accessibility-law applicability assessment. When the service is in scope, required accessibility information, feedback/contact, monitoring, and remediation paths are present and tested; regardless of scope, critical public and portal flows meet the approved WCAG 2.2 AA product gate.

### Content and engagement

- **AC-CMS-001:** Draft content is never public; publish updates the selected locale and creates revision/audit. Restore creates a new draft rather than deleting history.
- **AC-REV-001:** A public review remains invisible in `PENDING`; approval publishes only intended display fields. Editing display content preserves original text.
- **AC-PIC-001:** A valid picker application creates `NEW`, stores acknowledgement/version, and notifies staff; it creates no login or payment record.
- **AC-MSG-001:** A valid contact message creates `NEW`, can move to `READ/REPLIED/CLOSED`, and does not require the system to send a reply.

### Roles and notifications

- **AC-IAM-001:** Staff cannot manage users/roles/sensitive settings; Content Editor cannot access any order/customer/applicant/message/payment data through UI or direct API.
- **AC-IAM-002:** The last active Platform Admin cannot be removed/demoted/suspended; an active shop cannot lose its last Manager without an atomic replacement or shop closure.
- **AC-IAM-003:** Manager can execute every shop-scoped UI/API action, including approving their own financial record, but cannot access another shop or platform-only settings. Platform Admin can execute the same action in explicit selected-shop context and additionally manage shops/platform controls; all actions retain correct audit and tenant context.
- **AC-NTF-001:** A `NEW` order still unresolved at 15 minutes receives one initial in-app reminder; eligible recipients receive email only when their category preference is enabled.
- **AC-NTF-002:** Disabling email retains in-app notification and dashboard overdue state.

### Reporting, finance, suppliers, staff earnings, and invoices

- **AC-FIN-001:** Given €1,000 recognized revenue, €100 refunds, €250 approved non-staff costs, and €300 approved staff picking cost in an ISO week, the report shows net revenue €900, result before staff picking cost €650, and estimated profit after staff picking cost €350.
- **AC-FIN-002:** A completed order is recognized exactly once when first reaching `PICKED_UP`/`DELIVERED`; payment status changes do not duplicate revenue.
- **AC-FIN-003:** A refund created in week 33 reduces week 33 net revenue and links to its original sale even if the sale occurred in week 32.
- **AC-FIN-004:** One-time, recurring, and manual allocations reconcile to the source expense total with no rounding loss/double counting.
- **AC-FIN-005:** An external purchase calculated from litres × €/L appears once as non-staff cost; its linked expense/payment record cannot make it appear twice.
- **AC-FIN-006:** Each compensation method calculates correctly; an approved adjustment requires reason and cannot make final earning negative.
- **AC-FIN-007:** Draft/rejected records do not affect reports; approved and paid records do, exactly once. Manager and Platform Admin in selected-shop context can create, submit, approve, correct, and pay the same record without a self-approval rejection, while each action/context remains separately audited.
- **AC-AVL-003:** Manual sold-out changes no order, reservation, capacity movement, sold/delivered litre, revenue, refund, expense, purchase, Picking Entry, or payment total. Internal availability reporting records the override cause/period separately; sales/finance/fulfillment reports continue to reconcile only to authoritative transactions.
- **AC-FIN-008:** Staff sees only their own earnings; direct API/export attempts to access another staff’s amounts are denied.
- **AC-RPT-001:** ISO week boundaries follow Monday–Sunday in the configured shop timezone, including year/DST boundaries; applied filters and formula/data-cutoff metadata are visible.
- **AC-RPT-002:** CSV and PDF exports reconcile to the on-screen report/source totals and enforce identical permission filters.
- **AC-INV-001:** Issuing an eligible invoice assigns one unique number/version, snapshots all content, and produces a downloadable PDF without sending customer email.
- **AC-INV-002:** Changing current customer/product/settings data after invoice issue does not change the issued PDF; material correction creates a new auditable version/process.
- **AC-INV-003:** Concurrent/retried issue commands cannot create duplicate invoice numbers or versions.
- **AC-DOC-001:** Order Summary PDF is localized, contains the order/shop/customer/fulfillment snapshot, has no invoice number/tax UI, does not send automatically, and remains distinct from Invoice PDF.
- **AC-MED-001:** Multiple images/uploaded videos/YouTube/Vimeo references can be ordered with exactly one primary item; unsafe embeds/files are rejected and gallery remains usable without video playback.
- **AC-SRC-001:** Manager configures/archives a source; website assigns its configured source, manual order requires one, and historical orders preserve source snapshot after archive/rename.
- **AC-QLT-001:** External purchase resolves effective product+grade supplier/default buy rate, snapshots it, requires separate mixed-grade lines, and reports correct cost; manual override requires permission/reason.

### Multi-tenancy, analytics, and channels

- **AC-TEN-001:** Identical customer/product/order identifiers/contact values in Shop A and B remain isolated; every API/list/search/export/media/job/cache/inbox/report access from the other shop is denied or excluded.
- **AC-TEN-002:** Platform Admin provisions a shop and primary Manager; isolated defaults are created once. Manager cannot grant Platform Admin, manage another shop, or access platform security.
- **AC-TEN-003:** A multi-shop user sees only assigned shops and explicit active-shop context; switching context never mixes cached/list/form data.
- **AC-TEN-004:** Suspended shop rejects public forms and undispatched channel sends while preserving authorized retained data and audit.
- **AC-ANA-001:** Without optional analytics preference, no analytics session/funnel events are stored; order processing still works.
- **AC-ANA-002:** With analytics enabled, events contain no entered field values/PII; form start without successful submit becomes abandonment only after configured expiry.
- **AC-ANA-003:** Funnel report separates eligible-session abandonment from authoritative order statuses and displays coverage/exclusions.
- **AC-CHN-001:** Connection credentials remain secret; expired/revoked scopes move connection to degraded/expired and pause affected actions with an actionable error.
- **AC-CHN-002:** Facebook Page content publishes/schedules idempotently when supported; Group target produces manual-share package and never records provider-published success automatically.
- **AC-CHN-003:** Valid signed inbound webhook creates one same-shop inbox message; invalid signature/wrong account is rejected and duplicate event creates no duplicate.
- **AC-CHN-004:** Stable WhatsApp/provider ID matches within the shop; display-name-only match requires confirmation and never links automatically.
- **AC-CHN-005:** Shared-inbox reply enforces permission and provider template/window capability; internal note cannot be sent.
- **AC-CHN-006:** Marketing broadcast sends only to customers whose evidence covers exact shop/channel and who remain eligible at dispatch; withdrawal after scheduling excludes the recipient.
- **AC-CHN-007:** The initial direct-marketing checkbox names WhatsApp only and creates WhatsApp-specific evidence. Messenger or any later channel requires a separately enabled, channel-specific approved statement and evidence; prior WhatsApp consent is never treated as consent for it.
- **AC-CHN-008:** Scheduled campaign retries do not duplicate recipient sends; cancellation stops unsent recipients; provider callback updates state idempotently.

## 2. Form test considerations

For every form test:

- Empty, minimum, maximum, over-maximum, whitespace-only, Unicode Finnish names, Vietnamese names, apostrophes/hyphens, emoji where inappropriate, and malicious HTML/script.
- Keyboard-only, screen reader semantics, focus after errors, zoom/reflow, color contrast, and mobile touch targets.
- Finnish and English labels/errors, locale retention, correct date/time/EUR display.
- Back/refresh/retry, double-click, slow network, timeout, offline interruption, server error, and expired admin session.
- Client validation bypass and unknown/read-only field manipulation at API level.
- Spam/rate-limit behavior and privacy-safe logs.

Order-specific boundaries: quantity `-1, 0, 1, max, max+1, 1.5`; remaining capacity exactly equal/one litre below; package activation boundary; cutoff equality; date rollover; fee threshold `threshold-1 package unit`, equal, above; malformed Finnish postal codes; switch pickup ↔ delivery; stale price/capacity.

## 3. State and time test matrix

- Exercise every allowed and forbidden state pair.
- Verify required reasons/evidence and permission matrix per transition.
- Verify capacity movement on initial creation/edit/cancellation and absence of movement on forward/exception/refund transitions.
- Use a controllable clock for 09:59, 10:00, 10:01, 18:59, 19:00, cutoff boundary, midnight, leap day, and Europe/Helsinki DST transitions.
- Verify delayed scheduler, duplicate worker delivery, partial provider failure, and concurrent human/scheduler updates.

## 4. Security tests

- Authentication/session/MFA/recovery, CSRF, XSS, SQL/NoSQL injection, mass assignment, file upload, SSRF where relevant, brute force/rate limiting.
- Horizontal access by changing object IDs; vertical access across all role endpoints.
- Public order reference enumeration and leakage through receipt/history endpoints.
- Sensitive data in URLs, browser history, cache, analytics, application/provider logs, email subject/body, and error pages.
- Audit integrity, last-Platform-Admin and active-shop last-Manager protections.
- Supplier bank/payment details, receipts, staff earnings, reports, exports, and invoice object downloads across roles/users.
- Cross-tenant access through every object relationship, public host/slug, membership/shop switch, support mode, media/embed, export, job, webhook and provider connection.
- OAuth state/scope/token lifecycle, webhook signature/replay, outbound consent/suppression/frequency, shared-inbox attachment and internal-note separation.

## 5. Performance and resilience tests

- Load public pages and order submissions at agreed peak with realistic database size.
- Burst concurrency against one remaining package/capacity row.
- Race a manual sold-out command against order submission; the committed winner determines the outcome, no order is accepted after sold-out commits, and neither path creates partial effects.
- Email provider unavailable: orders succeed and outbox retries.
- Worker stopped across 10:00/19:00 then restarted: missed work is recovered once.
- Database transaction rollback at each order step: no orphan customer/order/movement inconsistencies.
- Backup restoration rehearsal and reconciliation of availability ledger.
- Financial reconciliation across source orders/refunds/expenses/external purchases/picking entries and aggregate reports.
- PDF generation failure/retry, Unicode/font/layout, long invoice fields, page breaks, checksum, authorization, and expired download links.
- Uploaded-video quota/format/duration/malware/transcoding failure and privacy-enhanced allowlisted external embeds.
- Provider outage/rate limit/token expiry/template rejection/webhook reorder/duplicate and broadcast partial recovery.
- Platform/shop switch combinations, default-off new shop, disable-after-quote/no-provider-call proof, unauthorized Staff toggle, Google address/routes timeout, invalid/ambiguous suggestion, no drivable route, quota exhaustion, key rejection, shorter-route absence, stale quote, changed origin/rule/enablement, and recovery to a newly calculated quote.

## 6. Test data

Maintain synthetic fixtures for active/inactive products/packages; naturally sold-out, manually sold-out, open, and closed dates; inside/outside/unverifiable postal zones; threshold quantities; all statuses/payment states; duplicate/conflicting customers; four canonical roles and custom shop permissions; both locales; consent grant/withdraw; pending/published reviews; new/aged messages/applications.

Also include orders recognized/refunded across week boundaries, linked external purchase/expense records, each allocation/compensation method, successful audited Manager/Platform-Admin self-approval plus denied Staff approval attempts, supplier archives, multi-page invoices with MVP VAT/tax fields hidden plus future-schema contract fixtures, and financial exports with restricted staff scope.

Add at least two tenants with deliberately identical names/contact/source codes, multi-shop memberships, suspended shop, product galleries, several fixed-size packages, manual multi-quantity orders, customer areas, decline/cancellation reasons, quality/rate boundaries, analytics preferences/sessions, connected/degraded providers, template/window conditions, channel-specific consent grants/withdrawals, segments, campaigns and inbox threads.

Never use real customer production data in lower environments.

## 7. Automation layers

- Unit/property tests: calculations, normalization, state transitions, delivery fee, timing, consent/current-state derivation.
- Database/integration tests: capacity concurrency, transactions, constraints, outbox/idempotency, migrations.
- API contract tests: validation, authorization, error codes, version conflicts.
- Browser E2E: critical public order paths, admin confirmation/fulfillment, content publish, review moderation.
- Accessibility automated checks plus manual keyboard/screen-reader validation.
- Production smoke tests use synthetic/non-deliverable records with cleanup/audit policy.

## 8. MVP release gates

- All acceptance scenarios assigned to the target release in the phase traceability matrix pass; every acceptance scenario is required by the Extended MVP unless an approved decision record explicitly reclassifies it.
- No open critical/high security vulnerability or accessibility blocker in critical flows.
- Zero reproducible oversell or duplicate-order defect.
- Backup restore, scheduler recovery, and notification-provider failure behavior demonstrated.
- Finnish and English critical journeys approved.
- Privacy notice, retention decisions, processor review, operational runbooks, and role assignments approved by accountable owners.
