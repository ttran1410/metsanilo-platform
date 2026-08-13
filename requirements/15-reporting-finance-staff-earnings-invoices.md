# 15 — Reporting, Finance, Staff Earnings and Invoices

> **v0.0.1 boundary — ADR-0005 applies.** Implement only order payment records, invoice PDF issue/download, record-only external pickers, and picking records in litres or kilograms with unit-specific buy prices. Expenses, supplier purchases, quality/rates, staff compensation, weekly profit reports, exports, payroll, and accounting workflows are deferred.

## 1. Purpose and boundary

This module provides management visibility into whether METSÄNILO is economically viable. It is a management-reporting subsystem, not a substitute for statutory bookkeeping, payroll, VAT returns, tax calculations, bank reconciliation, or professional accounting advice.

It must answer two separate questions:

1. What result does the business produce before assigning a cost to staff berry-picking work?
2. What estimated profit remains after staff picking earnings are treated as a business cost?

## 2. Canonical weekly financial statement

For an ISO Monday–Sunday week in `Europe/Helsinki`:

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

### 4.1 Weekly financial overview

- Revenue, refunds, net revenue.
- Each non-staff cost category.
- Result before staff picking cost.
- Staff picking cost.
- Estimated profit after staff picking cost.
- Gross/net/VAT basis indicator.
- Comparison to prior week and optional season-to-date.
- Drill-down to source orders/refunds/expenses/purchases/picking entries.

### 4.2 Sales and product report

- Orders, litres, gross/net recognized revenue, average order value.
- Product/package mix.
- Pickup versus delivery.
- Delivery-fee revenue.
- Order source: website, WhatsApp, Messenger, SMS, phone, other.
- Order outcomes and refunds.

### 4.3 Capacity and operations report

- Configured, reserved, remaining, fulfilled, cancelled, rejected/no-show litres by product/date.
- Capacity utilization.
- Natural capacity exhaustion and manual sold-out periods as separate operational facts, including private actor/reason/timestamps only for authorized internal users.
- Average/percentile time `NEW → CONFIRMED/CANCELLED`.
- Overdue-new and overdue-picking counts.
- Fulfillment outcomes and workload.

Manual sold-out state never contributes an order, sold/delivered litre, revenue, refund, expense, purchase, Picking Entry, or payment amount. Every sales, fulfillment, expense, and finance total reconciles only to its authoritative transaction records.

### 4.4 Customer report

- New/repeat customers and repeat rate.
- Orders/revenue/average order value by non-identifying area or permitted customer view.
- Customer drill-down only for roles with customer permission.
- Marketing-consent counts are separate and do not imply campaign capability.

### 4.5 Delivery economics

- Delivery order count/litres/revenue.
- Delivery fees collected.
- Fuel/delivery expenses.
- Approximate delivery contribution: delivery fees minus tagged fuel/delivery costs.
- Inside/outside/manual-agreement breakdown.

### 4.6 Supply and picking report

- Staff litres and approved earnings by staff/product/date.
- External supplier litres and cost by supplier/product/date.
- Total sourced litres and average cost per litre.
- Staff own view shows only that staff member’s entries/earnings; Manager, Platform Admin in selected-shop context, or an explicitly granted earnings-read scope shows all.

## 5. Filters and comparisons

- Current/previous ISO week, month, season-to-date, custom date range.
- Product/package, staff, supplier, expense category.
- Pickup/delivery, order source, order outcome.
- Approval/payment state for cost/earning views.
- Gross/net basis where data supports it.
- Compare with immediately preceding equivalent period.

Every report displays timezone, currency, applied filters, formula version, generated/data-as-of times, and whether any source records remain draft/unapproved.

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
