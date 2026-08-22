# 15 — Reporting, Finance, Staff Earnings and Invoices

> **Reporting v1 boundary — ADR-0015 applies.** Build on-screen and CSV reports from existing order, capacity, payment, refund, and customer records. Expenses, supplier purchases, picking costs, profit, VAT, PDF report export, payroll, and accounting workflows remain phase-two work.

## 1. Purpose and boundary

Reporting v1 gives permitted shop users operational, fulfilled-sales, payment, refund, capacity, and customer-health visibility. It is not a substitute for statutory bookkeeping, payroll, VAT returns, tax calculations, bank reconciliation, or professional accounting advice.

The phase-two financial module must later answer two separate questions:

1. What result does the business produce before assigning a cost to staff berry-picking work?
2. What estimated profit remains after staff picking earnings are treated as a business cost?

## 2. Future canonical weekly financial statement

Phase two uses this ISO Monday–Sunday statement in `Europe/Helsinki` after the required authoritative cost records exist:

```text
Gross recognized revenue
- refunds recognized during the week
= net revenue

Net revenue
- external berry purchase cost
- fuel and delivery cost
- packaging and bucket cost
- equipment/allocated cost
- other approved non-staff operating cost
= operating result before staff picking cost

Operating result before staff picking cost
- approved staff picking earnings
= estimated operating profit after staff picking cost
```

Both result lines must always be shown together and named consistently. “Income” by itself is avoided because it can mean revenue, staff compensation, or business profit.

Example:

| Measure | Amount |
|---|---:|
| Gross recognized revenue | €1,000 |
| Refunds | -€100 |
| Net revenue | €900 |
| Non-staff operating costs | -€250 |
| **Operating result before staff picking cost** | **€650** |
| Staff picking cost | -€300 |
| **Estimated operating profit after staff picking cost** | **€350** |

## 3. Recognition and attribution

| Fact | Reporting date/basis |
|---|---|
| Order revenue | Actual first transition to `PICKED_UP` or `DELIVERED` |
| Refund | Refund event timestamp; linked to original order and sale period |
| One-time expense | Expense date |
| Recurring/manual expense | Stored allocation period/rows |
| External berry purchase | Approved purchase date/allocation; counted once |
| Staff picking earning | Approved Picking Entry’s picking date by default |
| Delivery fee revenue | Included in the completed order’s recognized total and shown separately as a component |
| Payment/cash state | Separate cash-status dimension; does not by itself determine recognition |

Late entry or correction appears in the period dictated by the corrected fact and is visibly labeled as a later adjustment when a previously closed/report-exported period changes. Formula and data-cutoff versions allow reproduction.

## 4. Reporting catalogue

Reporting v1 contains five on-screen views. Four detailed views also support CSV export; Overview remains screen-only.

### 4.1 Overview

Overview answers what needs attention and whether today and the current week are progressing.

- Orders requiring action and overdue work.
- Today’s fulfillment stages and litres.
- Today and three-day capacity pressure.
- Current-week fulfilled litres and fulfilled sales with prior-period comparison.
- Season fulfilled-litre progress when a goal is configured.
- Recorded cash and outstanding amount shown separately from fulfilled sales.

### 4.2 Sales and fulfillment

Sales and fulfillment reports completed physical handovers and their commercial snapshots.

- Fulfilled orders, litres, fulfilled sales, average order value, and refunds.
- Product/package mix.
- Pickup versus delivery.
- Delivery-fee component.
- Configured order source.
- Fulfillment outcomes.
- Privacy-protected delivery-destination breakdown.

Average order value equals fulfilled sales divided by fulfilled orders. Refunds remain separate and do not alter average order value.

### 4.3 Capacity and demand

Capacity and demand reports operational ceilings and outcomes without reconstructing unavailable historical plans.

- Final configured, reserved, remaining, fulfilled, and post-picking unfulfilled litres by product/date.
- Capacity utilization.
- Current natural capacity exhaustion and manual sold-out facts, with private audit details only for authorized users.
- Average and percentile time from `NEW` to confirmation or terminal resolution.
- Overdue-new and overdue-picking counts.
- Fulfillment outcomes and workload.

Manual sold-out state never contributes an order, sold/delivered litre, revenue, refund, expense, purchase, Picking Entry, or payment amount. Every total reconciles only to authoritative transaction records.

### 4.4 Payments and refunds

Payments and refunds separates recorded cash movement from fulfilled-sales recognition.

- Payment and refund movement by `recorded_at`.
- Retained cash: payments minus refunds.
- Current outstanding amount: resolved order total minus payments recorded.
- Payment method and state.
- `Refund required` exceptions for cancelled orders with recorded payments.
- Drill-down to append-only payment and refund records.

A refund never recreates customer debt. A fully paid and fully refunded order has zero outstanding amount and zero retained cash.

### 4.5 Customer health

Customer health measures repeat fulfillment behavior without exposing identity through aggregate reporting.

- New customers whose first-ever fulfilled order occurs in the period.
- Repeat customers with a fulfilled order in the period and at least one earlier fulfilled order.
- Repeat rate among identifiable fulfilled customers.
- Stable-link coverage and the count excluded for missing or unresolved customer identity.
- Permission-protected drill-down to customer records.
- Marketing-consent counts shown separately from fulfillment behavior.

### 4.6 Phase-two catalogue

Phase two adds reports only after their authoritative source modules exist.

- Revenue, refunds, net revenue.
- Each non-staff cost category.
- Result before staff picking cost.
- Staff picking cost.
- Estimated profit after staff picking cost.
- Gross/net/VAT basis indicator.
- Comparison to prior week and optional season-to-date.
- Drill-down to source orders, refunds, expenses, purchases, and picking entries.
- Delivery order count, litres, and revenue.
- Delivery fees collected.
- Fuel/delivery expenses.
- Approximate delivery contribution: delivery fees minus tagged fuel/delivery costs.
- Inside/outside/manual-agreement breakdown.
- Staff litres and approved earnings by staff/product/date.
- External supplier litres and cost by supplier/product/date.
- Total sourced litres and average cost per litre.
- Staff own view shows only that staff member’s entries/earnings; Manager, Platform Admin in selected-shop context, or an explicitly granted earnings-read scope shows all.

## 5. Filters and comparisons

Reporting v1 uses a shared period and product filter plus relevant view-specific controls.

- Period: today, current ISO week, previous ISO week, current month, season, or custom range.
- Time grouping: day, ISO week, or month.
- Product: all permitted products or one product.
- Sales: package, fulfillment method, order source, and outcome.
- Capacity: season and outcome.
- Payments: payment method, payment/refund, and payment state.
- Customer health: new/repeat, product, order source, and fulfillment method.
- Compare with the immediately preceding equivalent period; partial periods compare with the same elapsed portion.

An individual customer is not a general report filter. Identifying customer drill-down requires `customers.read`.

Every reporting-v1 view and CSV displays timezone, currency, applied filters, formula version, and generated/data-as-of times. Customer health also displays linkage coverage. Future cost reports must additionally disclose any draft or unapproved source records.

## 6. Expense management

### Categories

Initial configurable categories:

- `PACKAGING_BUCKETS`
- `EXTERNAL_BERRY_PURCHASE`
- `FUEL_DELIVERY`
- `EQUIPMENT`
- `STAFF_PICKING`
- `OTHER`

External purchases and staff picking costs originate from their specialized records and may link to a canonical expense fact. The reporting layer deduplicates by canonical cost identity.

### Allocation methods

- `ONE_TIME`: entire approved amount on expense date.
- `RECURRING`: generated occurrences based on configured recurrence; each occurrence is reviewable.
- `MANUAL_ALLOCATION`: explicit amount per reporting date/range. Allocation sum equals source total.

This supports practical allocation of reusable buckets/equipment without attempting statutory depreciation.

### Workflow

`DRAFT → SUBMITTED → APPROVED → PAID`, with `REJECTED`/correction behavior. Approval recognizes the cost; Paid tracks settlement. Manager and Platform Admin in selected-shop context may perform every workflow action, including self-approval/payment; each action remains a distinct audit event. There is no Finance Approver or External Accountant portal role in MVP.

## 7. Staff picking and earnings (future)

The compensation model below is future scope. The v0.0.1 picking record uses one unit (`LITRE` or `KILOGRAM`), a positive quantity, a buy price per selected unit, and a server-calculated total. It does not calculate wages, hours, or payroll.

### Unit of record

One Picking Entry represents:

```text
one staff member
+ one product
+ one picking date
+ production quantity
+ compensation calculation
```

It is deliberately not allocated to orders.

### Compensation methods

| Method | Calculation |
|---|---|
| `PER_LITRE` | litres × snapshotted €/L rate |
| `PER_HOUR` | hours × snapshotted €/hour rate; litres still recorded for productivity |
| `FIXED` | snapshotted fixed amount; litres still recorded |
| Adjustment | approved positive/negative addition with mandatory reason; final earning cannot be negative |

Rate resolution order should be explicit, for example staff + product + method + effective date, then configured fallback. Overlap is rejected or resolved deterministically. Changing a future rate never changes approved history.

### Privacy, authorization, and audit

- Staff creates/views own entries and totals.
- Manager and Platform Admin in selected-shop context view all staff earnings/rates and may perform every workflow action, including self-approval; Staff remains limited to own earnings unless a separate read permission is granted.
- Approval and mark-paid permissions may be separate.
- Aggregate operational reports avoid staff names unless necessary and permitted.

## 8. Suppliers and external berry purchases

Supplier profiles represent external pickers/vendors and are distinct from staff, customers, and picker applications. A future approved picker applicant may be converted/linked to a Supplier only through an explicit Manager-controlled process; records are not silently merged.

Purchase cost usually equals litres × €/L. An authorized total override requires a reason. External purchases follow `DRAFT → SUBMITTED → APPROVED → PAID`, with rejection/correction controls. Approval recognizes cost; Paid tracks settlement. Manager and Platform Admin in selected-shop context may approve their own purchase; workflow actions remain individually audited. Supplier payment details are restricted and excluded from ordinary exports.

## 9. CSV export

Sales and fulfillment, Capacity and demand, Payments and refunds, and Customer health provide reporting-v1 CSV exports. Overview remains screen-only.

- UTF-8 with stable English machine column names and ISO dates/timestamps.
- Decimal/currency semantics documented; no locale-formatted ambiguity in machine fields.
- Summary export and permitted detailed-source export are separate choices.
- Include formula version, timezone, currency, filters, generated/data-as-of times in metadata columns/header companion where format permits.
- Prevent spreadsheet formula injection by escaping dangerous leading characters in user-entered cells.

## 10. PDF report export

- Human-readable title, reporting period, business name, filters, timezone/currency, generated/data-as-of times.
- Financial summary and selected report sections with page numbers.
- Formula definitions/footnote that profit is an estimated management result.
- Repeat table headers across pages; handle Finnish/Unicode names and long labels.
- Permission scope identical to screen/CSV.
- Generated asynchronously when necessary with short-lived authorized download.

## 11. Invoice PDF

### MVP behavior

- Authorized Manager/permitted Staff previews, issues, and downloads an invoice for an eligible order.
- Customer does not log in to obtain it.
- System does not automatically email/message the invoice.
- Staff may manually provide the downloaded PDF through an external channel.

### Invoice snapshot content

- Seller legal/business name, address/contact and required business/tax identifiers.
- Unique invoice number/version, issue date and due date where applicable.
- Customer name and billing/delivery address snapshot as applicable.
- Order reference, fulfillment date/method.
- Item descriptions, quantities, package litres, unit/line amounts, delivery fee.
- Net/VAT/gross values and tax wording when applicable.
- Payment method/status/reference and payment instructions/terms.
- Currency EUR, locale, notes and required legal text.

### Lifecycle and correction

`DRAFT → ISSUED`; an issued invoice is immutable. Preview does not consume a number. Material correction creates a version/correction/credit-note process after accounting policy is approved. `VOID` does not erase the issued artifact/audit.

### Future flexibility

The application emits/stores an invoice-issued event and uses an `InvoiceDeliveryGateway` boundary. A later phase can add secure customer email delivery, delivery tracking, portal download, e-invoicing, accounting export, or payment integration without changing the issued invoice snapshot model.

## 12. Reconciliation controls

For each report period:

- Recognized order total reconciles to included completed-order snapshots.
- Refund total reconciles to refund records.
- Expense category totals reconcile to approved source/allocation records.
- External purchases and linked expenses count once.
- Staff cost reconciles to approved Picking Entries; Paid state does not duplicate it.
- Result formula recomputes from displayed components exactly, with explicit rounding.
- Drill-down totals equal the displayed aggregate.
- Export total equals screen total for the same filter/formula/data cutoff.

Any reconciliation failure is an operational error surfaced to Manager and permitted financial-report readers; the system must not silently publish a misleading financial total.
