# 03 — Business Rules and Validation

> **Active scope override — ADR-0005 and ADR-0015 apply.** Capacity, sold-out, order, pickup, payment, reporting-v1, and authorization invariants below are retained. Google routing, postal zones, tenant/platform rules, connector consent, supplier/expense/quality/advanced-finance rules, and unapproved schedulers remain deferred.

## 1. Order and capacity rules

- **BR-ORD-001:** A public order is a request awaiting manual confirmation. Successful submission creates `NEW`, not `CONFIRMED`.
- **BR-ORD-002:** Each item quantity is a positive integer. Decimal, zero, negative, and free-form litre quantities are invalid.
- **BR-ORD-018:** Public MVP quantity is always 1 and is not customer-configurable. A manipulated non-1 public value is rejected with a stable validation error. Manual shop-user orders may use a positive integer quantity within capacity.
- **BR-ORD-003:** Item litres equal `package_litres × quantity`; order litres equal the sum across all items.
- **BR-ORD-004:** A public MVP order contains exactly one Order Item. Manual/historical orders may contain one or more items, but every item in one order shares one fulfillment date and method.
- **BR-ORD-005:** A product/package/date must be active, orderable, within cutoff, and have sufficient remaining capacity when submitted.
- **BR-ORD-006:** `NEW` and `CONFIRMED` hold capacity. `PICKING`, `READY`, `OUT_FOR_DELIVERY`, `PICKED_UP`, and `DELIVERED` represent capacity already committed/consumed.
- **BR-ORD-007:** `CUSTOMER_DECLINED` and cancellation from `NEW`/`CONFIRMED` release capacity once. Cancellation from `PICKING`, `READY`, or `OUT_FOR_DELIVERY`, plus `REJECTED`, `NO_SHOW`, and refunds, do not restore availability because picking/preparation has begun or fulfillment is historical. Reporting classifies a later non-fulfilled outcome as post-picking unfulfilled litres without asserting physical waste.
- **BR-ORD-008:** Concurrent orders may not make remaining capacity negative. Validation and reservation occur within one atomic operation.
- **BR-ORD-009:** When an edit increases required litres or changes the product/date, the new capacity must be secured before releasing the old reservation; failure leaves the order unchanged.
- **BR-ORD-010:** Price and delivery fee are calculated server-side. Client totals are informational only.
- **BR-ORD-011:** Historical completed orders entered after fulfillment do not consume current availability but must retain reported litres and fulfillment facts.
- **BR-ORD-012:** A cancellation requires a reason code and optional notes. Cancellation from `PICKING` or `READY` requires explicit confirmation because work may have been performed.
- **BR-ORD-013:** An order public reference must be non-sequential enough not to expose sales volume and must be unique.
- **BR-ORD-014:** Manual status overrides require permission, a reason, and an audit record.
- **BR-ORD-015:** `CUSTOMER_DECLINED` is permitted only from `NEW` after a customer explicitly declines before confirmation; it requires a reason such as delivery fee, price, date, quantity, or other.
- **BR-ORD-016:** `CANCELLED_BY_CUSTOMER` represents customer-initiated cancellation after `CONFIRMED`; business/unreachable cancellation remains `CANCELLED` with actor/reason metadata.
- **BR-ORD-017:** Public fulfillment date must be today or future in the shop timezone and open under cutoff rules. Backdated orders use the historical workflow, do not change past capacity, and contribute to reporting using actual fulfillment/outcome dates.
- **BR-ORD-019:** Public submission creates a pending reservation request and does not itself form the sales contract. Contract formation is recorded when authorized staff confirms the order after any required delivery agreement. The approved terms and pre-contract disclosures must make this timing prominent and unavoidable in the order path, and the customer shall not be charged before confirmation. Production use remains blocked until Finnish consumer-law review approves the exact flow and wording.

### Product and availability boundaries

- **BR-PRD-001:** `available_from` and `available_through` are inclusive business dates in the shop timezone, and `available_from <= available_through`. Public and live manual fulfillment dates must fall inside this window as well as satisfy package, cutoff, and capacity rules.
- **BR-PRD-002:** Single-day, ISO-week, calendar-month, and custom-range availability actions resolve to an explicit set of business dates. Today is a valid editable target when it is inside the product window, even after the public order cutoff. If any target date is outside the product window, is a historical date, or is otherwise invalid, the entire command is rejected with no partial availability change.
- **BR-PRD-003:** A referenced product/package cannot be hard-deleted. Shortening a product window across a retained dated fact is forbidden; future unreserved availability outside the proposed window must be explicitly removed in the same confirmed transaction or beforehand.

### Sold-out and public availability

- **BR-AVL-001:** Effective public availability is `SOLD_OUT` when a product/date has `manual_sold_out = true` or calculated remaining litres equal zero. New order validation rejects the product/date in either case. A normal `accepts_orders = false`, out-of-window, or cutoff closure remains an unavailable/closed scheduling state rather than a manual claim of capacity exhaustion.
- **BR-AVL-002:** A sold-out public view shows no numeric remaining value or internal reason. When the product/date is otherwise open and remaining litres are positive, exact remaining litres are shown. A same-day capacity edit immediately recomputes remaining/effective state, but does not bypass cutoff, change `accepts_orders`, or clear `manual_sold_out`; clearing a manual override likewise recomputes state from the current window, cutoff, acceptance flag, and remaining litres.
- **BR-AVL-003:** Setting/clearing manual sold-out never changes capacity movements, existing reservations/orders, fulfilled/delivered litres, revenue, refunds, expenses, purchases, Picking Entries, or payment facts. Internal operations reporting distinguishes natural capacity exhaustion from manual override and retains actor/reason/timestamps.

## 2. Customer matching rules

- **BR-CUS-001:** Mobile numbers are normalized to an international comparable format where possible; Finnish local numbers use the configured country context.
- **BR-CUS-002:** Exact normalized primary-mobile match has first priority, exact case-insensitive normalized email second. Connector-specific identifiers and Messenger/Facebook display names are future scope and never drive pilot matching.
- **BR-CUS-003:** Conflicting matches, such as phone matching one customer and email another, must not auto-link or merge either profile. Public submission creates a new provisional customer identity flagged for staff resolution while preserving the submitted order snapshot.
- **BR-CUS-004:** Public order submission creates a normal new customer when no candidate exists and a provisional customer when candidates are ambiguous/conflicting. Later resolution never rewrites the submitted snapshot.
- **BR-CUS-005:** A profile edit never rewrites snapshots on existing orders.
- **BR-CUS-006:** Customer anonymization does not erase audit, financial, volume, product, or status facts that must be retained; access to any legally retained identifier must be restricted.
- **BR-CUS-007:** Customer area is optional. Automatic derivation uses the shop’s configured postal/address-area mapping and records `AUTO` source/confidence; a manual value records `MANUAL`, actor, and timestamp and takes precedence until deliberately reset.

## 3. Contact information rules

- **BR-CON-001:** A public order requires customer name and mobile number. Email and Messenger identifier are optional.
- **BR-CON-002:** Manual shop-user orders require at least one contact channel: mobile or email; a reason is required if mobile is absent.
- **BR-CON-003:** Email format validation does not prove ownership. Mobile validation accepts international input and normalizes it server-side.
- **BR-CON-004:** Free-text fields are trimmed, length-limited, safely encoded, and must not render active HTML/script.

## 4. Delivery and pickup rules

- **BR-DLV-001:** Pickup requires a selected active pickup location and time slot available for the fulfillment date. Its complete customer-visible address and localized instructions appear in selection/review and again after a successful order commit.
- **BR-DLV-002:** The initial default pickup time is 20:00, overridden in order: specific date → weekday → global default.
- **BR-DLV-003:** Delivery requires recipient name, destination street address, postal code, city, and mobile number. Only local required-field/format validation runs; the destination is never sent to a mapping provider.
- **BR-DLV-004:** v0.0.1 has no automatic distance classification, postal-zone classifier, Google setting, or routing provider.
- **BR-DLV-005:** Every delivery order is publicly labeled “Delivery to be agreed”; no automatic free/paid distance rule applies.
- **BR-DLV-006:** Until an authorized user records an agreed non-negative fee, delivery fee and final total remain pending while item subtotal remains authoritative.
- **BR-DLV-007:** Admin, Manager, or Staff with `delivery.override` may set a manual fee only with a reason and agreement timestamp.
- **BR-DLV-008:** A manual fee is revalidated when order items, method, or destination changes; route quotes and provider enablement are future scope.

## 5. Payment rules

- **BR-PAY-001:** Supported MVP methods are `CASH`, `BANK_TRANSFER`, and `MOBILEPAY`; no external authorization occurs.
- **BR-PAY-002:** Payment status is independent of fulfillment status: `UNPAID`, `PENDING`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`, and `FAILED` are extensible values.
- **BR-PAY-003:** Marking payment `PAID` requires paid timestamp and user attribution. Refund status requires amount, timestamp, reason, and user attribution.
- **BR-PAY-004:** `PICKED_UP` or `DELIVERED` may remain `UNPAID` only with explicit confirmation because invoice/bank transfer may settle later.
- **BR-PAY-005:** A partial refund creates a refund Payment Record and sets payment summary to `PARTIALLY_REFUNDED` while the order remains `PICKED_UP` or `DELIVERED`. The order transitions to `REFUNDED` only when the full currently refundable amount has been refunded; cumulative refunds may never exceed that amount.

## 5A. Pilot picking-record rules

- Each picking record has exactly one `quantity_unit`: `LITRE` or `KILOGRAM`.
- Quantity is positive; buy price is non-negative and expressed per selected unit (`€/L` or `€/kg`).
- The server calculates `total = quantity × buy_price_per_unit`; client totals are informational only.
- Units are not automatically converted. Customer orders and capacity remain litres-only.

## 6. Privacy and consent rules

- **BR-PRV-001:** The order form presents the privacy notice and processing information. Processing strictly necessary for an order is not represented as optional marketing consent.
- **BR-PRV-002:** Marketing consent is not collected for v0.0.1; only order-processing/privacy notices are required. Channel-specific consent is future scope.
- **BR-PRV-003:** Consent evidence stores subject/customer, purpose, each channel named by the statement, granted/withdrawn timestamp, statement version, locale, tenant/shop, and source. Adding a future channel does not extend older consent and requires a new affirmative action.
- **BR-PRV-004:** Withdrawal is as easy as granting consent and does not affect order processing or retained order history.
- **BR-PRV-005:** Public review publication includes explicit acknowledgement that display name/rating/text will be public if approved.
- **BR-PRV-006:** Retention periods must be configurable/documented before production and applied through review/anonymization jobs, not arbitrary hard deletion.
- **BR-PRV-007:** Analytics/form-abandonment preference is separate from marketing consent. No form values, contact data, or free text are captured in funnel events.

## 7. Timing and automation rules

- **BR-AUT-001:** All business schedules execute using the shop-configured IANA timezone, initially `Europe/Helsinki`, including daylight-saving changes. Timestamps are stored in UTC plus tenant-local business-date semantics where needed.
- **BR-AUT-002:** At the configured picking start, initially 10:00, orders with `fulfillment_date = today` and `status = CONFIRMED` transition to `PICKING`.
- **BR-AUT-003:** If an order for today becomes `CONFIRMED` at or after picking start but before same-day cutoff, it transitions immediately to `PICKING` in the same logical operation.
- **BR-AUT-004:** Before picking start, a confirmed same-day order remains `CONFIRMED`.
- **BR-AUT-005:** After same-day cutoff, public same-day ordering is closed. An authorized user may override with a reason and explicit capacity confirmation.
- **BR-AUT-006:** At configured ready-review time, initially 19:00, today’s `PICKING` orders become overdue and trigger notification; their status remains `PICKING`.
- **BR-AUT-007:** A recovered/delayed scheduler processes missed eligible transitions once. Jobs must not duplicate history or notifications.
- **BR-AUT-008:** The 15-minute `NEW` reminder is measured from creation time and emitted once initially; optional repeat escalation may be configured later.

## 8. Content, review, and access rules

- **BR-CMS-001:** Draft changes have no public effect until published.
- **BR-CMS-002:** Published media requires alternative text in each published locale unless explicitly decorative.
- **BR-REV-001:** Reviews are never public before approval. Manager/permitted Staff edits preserve original text and editor identity.
- **BR-IAM-001:** Denied UI actions must also be denied at API/service level.
- **BR-IAM-002:** The single shop must retain at least one active Admin and one active Manager unless the shop is being closed.
- **BR-IAM-003:** Content Creator access is limited to assigned CMS/product/media permissions; it has no access to orders, customer data, payments, finance, or users unless explicitly assigned a narrowly scoped feature.
- **BR-IAM-004:** Authorization is evaluated against the single shop and the user’s feature permissions; no client-supplied tenant or shop identifier grants access.
- **BR-IAM-005:** Admin and Manager can manage Staff/Content Creator users and permissions but cannot grant Admin.
- **BR-IAM-006:** MFA is mandatory for every human Admin, Manager, Staff, and Content Creator account.
- **BR-IAM-007:** Admin and Manager have complete shop authority; Staff and Content Creator are limited by assigned permissions. No role bypasses validation, state, capacity, audit, immutable-history, or legal/security invariants.

## 9. Canonical validation behavior

- Validate required fields on blur when helpful and all fields on submit.
- Return field-level errors plus a focusable error summary.
- Preserve valid entered values after errors.
- Apply the same or stricter server validation; never trust hidden/read-only client fields.
- On capacity conflict, refresh availability and state the maximum currently available package quantity.
- On session expiry in admin forms, preserve a recoverable draft where safe and require reauthentication.
- Store localized display messages separately from stable machine-readable error codes.

## 10. Finance and reporting rules

- **BR-FIN-001:** Management revenue is recognized when an order first reaches `PICKED_UP` or `DELIVERED`, using the order’s snapshotted amount. Merely marking payment `PAID` does not recognize an unfulfilled order as revenue.
- **BR-FIN-002:** Refunds reduce net revenue in the business week containing the refund timestamp and retain a reference to the original recognized order/week.
- **BR-FIN-003:** The canonical formulas are:

```text
Gross recognized revenue
- refunds recognized in period
= net revenue

Net revenue
- non-staff operating costs
= operating result before staff picking cost

Operating result before staff picking cost
- approved staff picking cost
= estimated operating profit after staff picking cost
```

- **BR-FIN-004:** Non-staff operating costs include external berry purchases, fuel/delivery, packaging/buckets, equipment/allocation, and other approved expenses, excluding staff picking earnings.
- **BR-FIN-005:** Staff picking cost is calculated from approved Picking Entries in the selected reporting period; `PAID` is a cash-payment state, while approval establishes the management-reporting cost.
- **BR-FIN-006:** Weekly periods are ISO Monday 00:00 through Sunday 23:59:59 in the shop timezone, initially `Europe/Helsinki`, and are labeled by ISO week-year/week number.
- **BR-FIN-007:** One-time expenses are recognized on their expense date. Recurring/manual-allocation expenses are recognized according to stored allocation entries; allocated totals must reconcile exactly to the source expense.
- **BR-FIN-008:** External berry purchase total equals `litres × price_per_litre` unless an authorized total override is entered with a reason. It is a non-staff cost, not staff income.
- **BR-FIN-009:** Picking Entry earnings are calculated as: `litres × rate` for `PER_LITRE`, `hours × rate` for `PER_HOUR`, fixed rate for `FIXED`, plus approved adjustment. Inputs must be non-negative and an adjustment requires a reason.
- **BR-FIN-010:** Admin and Manager may approve a payment/invoice or picking entry they created/submitted. Staff may approve or mark paid only with explicit permissions. Creator, submitter, approver, payer, and role remain separately auditable even when the actor is the same.
- **BR-FIN-011:** Draft/rejected entries do not affect reports. Approved and Paid entries do; marking Paid must not count the cost twice.
- **BR-FIN-012:** Management reports display gross/net/VAT values when available and state the selected basis. Until VAT/accounting policy is approved, reported profit is explicitly “estimated management profit,” not taxable profit.
- **BR-FIN-013:** Report and export filters, formulas, timezone, currency, generation time, and data cutoff are displayed so results can be reproduced.
- **BR-INV-001:** Invoice eligibility and issue timing are configurable; default MVP behavior permits invoice generation after confirmation while labeling unpaid/payment status accurately.
- **BR-INV-002:** Invoice number is assigned once on issue, not on preview. Re-generated identical PDF retains the same invoice version; a material correction creates a new version/credit-correction process defined by accounting policy.
- **BR-INV-003:** Downloading an invoice never sends it to the customer and is audited when performed by an authorized shop user.

## 11. Catalog, source, quality, analytics, and channel rules

- **BR-MED-001:** Exactly one active image may be primary. Each product/page has at most four images; uploaded files are type/size validated and scanned without trusting arbitrary embed HTML.
- **BR-MED-002:** Video uploads and external video references are deferred for v0.0.1.
- **BR-SRC-001:** Order-source code is unique within a shop and immutable after first use. Label/category/order may change; used sources are archived, not deleted.
- **BR-SRC-002:** Campaign/referrer data is optional attribution metadata and does not replace the canonical order source.
- **BR-QLT-001:** External-purchase grade code is unique per shop and historical grades/rates are snapshotted. A used grade/rate is archived, not deleted or retroactively changed. Manager or Staff explicitly granted `quality.configure` may manage these records; Staff is denied the permission by default.
- **BR-QLT-002:** Buy-rate resolution is supplier-specific product+grade rate first, then shop product+grade default, valid on purchase date. Manual rate override requires permission and reason.
- **BR-QLT-003:** One external purchase line has one product, grade, litres, and snapshotted rate. Mixed grades use separate lines and aggregate to the purchase total.
- **BR-ANA-001:** Form abandonment means an analytics-eligible session emitted `FORM_STARTED` but no `ORDER_SUBMITTED` before the configured session-expiry window. It is not inferred from personal/order data.
- **BR-ANA-002:** Funnel reporting presents eligible-session counts and consent coverage; it must not label non-consenting visitors as abandoned or claim complete visitor coverage.
- **BR-CHN-001:** A marketing message may be queued only for customers whose unwithdrawn consent snapshot includes the exact channel and shop, and who are not suppressed/opted out.
- **BR-CHN-002:** Transactional messaging is limited to the relevant order/service purpose and must not be reused for promotion; provider template/window rules are validated at queue and dispatch.
- **BR-CHN-003:** Scheduled messages/posts are revalidated at dispatch for permission, connection health, consent, suppression, template status, and provider capability. Invalid recipients are excluded with reason; unsupported operations never silently fall back.
- **BR-CHN-004:** Inbound webhook authenticity, tenant/channel-account routing, provider event idempotency, and ordering are verified before creating/updating inbox records.
- **BR-CHN-005:** Facebook Group MVP behavior is manual-share preparation. The capability model may later expose auto-publish only when an authorized provider/API explicitly supports the target.
- **BR-TEN-001:** Tenant scope is part of every unique key/index where business identity is tenant-local and part of every cache key, job, outbox event, media path, export, and provider connection.
- **BR-TEN-002:** Suspended shops cannot accept public writes or dispatch channel messages; retained data remains isolated and available only under authorized platform/support policy.
