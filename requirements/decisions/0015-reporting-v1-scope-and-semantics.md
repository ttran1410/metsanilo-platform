# ADR-0015 — Reporting v1 scope and semantics

**Status:** Accepted  
**Date:** 2026-08-22

Reporting v1 gives permitted shop users operational, sales, fulfillment, payment, refund, and customer-health views from records the application already stores. It does not estimate profit, costs, VAT, or other facts that lack an authoritative source record.

## Context

The long-term reporting catalogue includes expenses, suppliers, picking earnings, delivery economics, VAT, invoices, and management profit. The current schema stores orders, fulfillment timestamps, capacity, payments, refunds, customers, order sources, and audit events. It does not yet store the cost and tax facts needed for the full catalogue.

The current Overview also presents active order value, recorded payments, and outstanding balances together as “Today’s revenue.” Reporting v1 must separate operational demand, fulfilled sales, and cash movement.

## Decision

Reporting v1 uses only current authoritative order, capacity, payment, refund, and customer records. `ADMIN`, `MANAGER`, and `STAFF` users receive an operational Overview when their assigned permissions allow it. Report APIs enforce the same permission boundary as their screens and drill-downs.

### Report catalogue

Reporting v1 contains these views.

| View | Primary question | Authoritative facts |
|---|---|---|
| Overview | What needs attention, and how is today or this week progressing? | Orders, availability, fulfillment timestamps, payments, and refunds |
| Sales and fulfillment | What was handed over, in what volume, and through which product, method, and source? | Completed order snapshots and refund records |
| Capacity and demand | How much can the shop accept, reserve, fulfill, or leave unfulfilled after picking starts? | Availability rows, order snapshots, and lifecycle status history |
| Payments and refunds | What cash activity was recorded, and what remains outstanding? | Append-only payment and refund records plus resolved order totals |
| Customer health | How many fulfilled customers are new or repeat, and how complete is customer linkage? | Customer links and completed order snapshots |

Profit, expenses, staff picking cost, suppliers, delivery contribution after costs, VAT, and accounting-grade exports remain phase-two work. Reporting v1 must not infer these values from notes, audit text, current prices, or manually sold-out state.

### Recognition and physical outcomes

The system recognizes an order’s full resolved value when the order first reaches `PICKED_UP` or `DELIVERED`. Payment timing does not change fulfilled-sales recognition.

The report uses these formulas:

```text
fulfilled sales = sum(final order total at first PICKED_UP or DELIVERED)
refunds recorded = sum(refund records by recorded timestamp)
sales after refunds = fulfilled sales - refunds recorded
cash recorded = payment records - refund records
outstanding amount = max(0, resolved order total - payments recorded)
```

Each metric applies the selected period to its own authoritative date:

| Metric | Date basis |
|---|---|
| Fulfilled sales and fulfilled litres | First `completed_at` timestamp for `PICKED_UP` or `DELIVERED` |
| Payment and refund movement | Payment or refund `recorded_at` timestamp |
| Capacity | Availability `business_date` |
| Operational outcomes | Order `fulfillment_date`, with lifecycle timestamps available in drill-down |
| New and repeat fulfilled customers | Completed order’s first `completed_at` timestamp |
| Outstanding amount | Point-in-time balance as of the report’s data cutoff, not a sum of period movements |

Fulfilled litres include orders that reached `PICKED_UP` or `DELIVERED`. A later refund does not reverse the physical handover fact.

A refund appears in the period containing its `recorded_at` timestamp and links to the original order and fulfillment period. It does not recreate customer debt. A paid order that receives a full refund has zero outstanding amount and zero retained cash. A cancelled order with a recorded payment appears as `Refund required`, not as customer debt.

A historical order contributes to its original completion period. Reports identify it as a historical or late entry and include the report generation time and data cutoff so a reader can tell when prior-period data changed.

The system reserves litres when it creates an order. It releases litres when an order ends from `NEW` or `CONFIRMED`. Once an order reaches `PICKING`, later cancellation, rejection, no-show, or refund does not reopen capacity. Reporting v1 calls a later non-fulfilled outcome **post-picking unfulfilled litres**. It does not call those litres waste because the system does not record discard, recovery, reuse, or resale.

### Filters and grouping

Each report uses a small shared filter bar plus report-specific filters. Time grouping is a display choice, not a separate data-access scope.

| Control | Values | Applies to |
|---|---|---|
| Period | Today, current ISO week, previous ISO week, current month, season, custom range | Every report |
| Time grouping | Day, ISO week, month | Trend charts and grouped tables |
| Product | All permitted products or one product | Sales, capacity, payments, and customer aggregates |
| Package | All packages or one package | Sales and fulfillment |
| Fulfillment method | All, pickup, delivery | Sales, payments, and customer aggregates |
| Order source | All configured sources or one source | Sales and customer aggregates |
| Outcome | Fulfilled or a specific terminal outcome | Sales and capacity |
| Payment dimension | Payment method, payment state, payment or refund | Payments and refunds |
| Season | All matching seasons or one season | Capacity and season progress |

An individual customer is not a general report filter. Users with customer-detail permission can drill down from Customer health or use the customer workspace. This keeps aggregate reporting separate from access to personal information.

Comparisons use the immediately preceding equivalent period. A partial current period compares with the same elapsed portion of the preceding period. When the earlier value is zero, the UI shows an absolute change and “New activity” instead of a percentage.

### Customer-area coverage

The current customer profile does not store an address. Orders store delivery-address snapshots, and pickup orders usually contain no customer address. Reporting v1 therefore does not label order destinations as customer residence.

Geographic reporting is a **delivery destination** breakdown within Sales and fulfillment:

- Group delivery orders by postal code when present.
- Fall back to city when postal code is absent and city is present.
- Put street-only delivery records in `Area unavailable`; do not infer an area from free text.
- Put pickup orders in `Address not collected`, separate from missing delivery data.
- Suppress any displayed area group with fewer than five distinct customers and combine it into `Other/private`.

### Customer classification and average order value

Customer health uses fulfilled orders and stable customer links so account creation timing does not distort repeat behavior.

- A new customer’s first-ever fulfilled order occurs in the selected period.
- A repeat customer has a fulfilled order in the selected period and at least one earlier fulfilled order.
- Repeat rate equals repeat fulfilled customers divided by all identifiable fulfilled customers in the period.
- Orders without a stable customer link, including unresolved identity conflicts, do not enter the percentage. The report shows their count and the resulting linkage coverage.
- Average order value equals fulfilled sales divided by fulfilled orders. Refunds remain a separate measure and do not alter average order value.

### Overview priorities

The Overview prioritizes fulfilled litres and fulfilled sales for the MVP. It keeps action and capacity information above historical analysis.

The recommended order is:

1. Orders requiring action and overdue work.
2. Today’s fulfillment stages and litres.
3. Today’s and upcoming capacity pressure.
4. Current-week fulfilled litres and fulfilled sales, with prior-period comparison.
5. Season fulfilled-litre progress when a goal is configured.

The Overview shows cash recorded and outstanding amount separately from fulfilled sales. It does not show profit or VAT in reporting v1.

## Season fulfilled-litre goal

`harvest_seasons.target_volume_ml` is the optional fulfilled-litre goal for one product season. Daily configured capacity remains a separate operational ceiling and does not derive from the goal.

The season create, edit, and clone UI must expose the field as **Fulfilled litre goal (L)**. The UI accepts positive whole litres or no value and converts the value to integer millilitres for storage. Admin and Manager can edit it; Staff can edit it only with `catalog.product.write`. Changes remain audited.

Season progress equals fulfilled litres assigned to the season divided by its fulfilled-litre goal. Reservations and post-picking unfulfilled litres do not count. Refunds do not reverse fulfilled-litre progress. When no goal exists, the UI hides the percentage.

An all-products progress view sums fulfilled litres and goals only for products with configured goals. It also displays goal coverage, such as `Goals configured for 2 of 3 products`, so a partial target set does not look complete.

## Permission model

Report access uses dedicated permission codes. A filter never expands a user’s authorized scope, and each report endpoint enforces the same scope as its screen and CSV export.

The permission catalogue is:

| Permission | Scope |
|---|---|
| `dashboard.read` | Operational Overview |
| `reports.sales.read` | Sales and fulfillment aggregates and permitted order drill-down |
| `reports.capacity.read` | Capacity and demand report |
| `reports.payments.read` | Payment, refund, and outstanding-balance report |
| `reports.customers.read` | Aggregate customer-health report |
| `customers.read` | Identifying customer drill-down |

Admin and Manager receive all reporting-v1 permissions by default. Staff receives `dashboard.read` and `reports.capacity.read` by default. Staff receives sales, payments, and customer-health reports only through explicit grants. Content Creator receives no reporting permission by default.

Report permission does not imply identifying drill-down permission. For example, `reports.customers.read` exposes aggregate new/repeat metrics, while opening an identifiable customer still requires `customers.read`.

## Historical capacity boundary

Reporting v1 uses the latest and final configured capacity stored for each product and business date. It does not reconstruct what the capacity plan showed at an earlier time of day.

Past-period reports label the measure **Final configured capacity**. They show final retained capacity, fulfilled litres, and post-picking unfulfilled litres. An exact as-of capacity-plan report requires a future append-only capacity-history model.

## Presentation

Each view pairs a small number of decision-focused visuals with an exact source table and drill-down links.

| View | Primary presentation |
|---|---|
| Overview | Action queue, fulfillment stages, today and three-day capacity pressure, current-week fulfilled litres and sales, and optional season progress |
| Sales and fulfillment | Fulfilled litres and sales trends, product/package bars, fulfillment/source mix, outcomes, refunds, and delivery destinations |
| Capacity and demand | Product-by-date utilization heatmap, capacity bars, and fulfilled versus post-picking unfulfilled outcomes |
| Payments and refunds | Payment and refund movement, retained cash, current outstanding amount, payment states, and source-record table |
| Customer health | New/repeat customer trend, repeat rate, linkage coverage, and permission-protected drill-down |

Charts never replace exact totals. Comparisons show absolute and percentage changes where the denominator permits them. Overview language emphasizes fulfilled litres and fulfilled sales without presenting booked demand or recorded cash as revenue.

## CSV export

Sales and fulfillment, Capacity and demand, Payments and refunds, and Customer health provide CSV export. Overview remains screen-only.

Each CSV uses the same filters, formula version, permission scope, timezone, data cutoff, and totals as the on-screen report. It uses stable English machine column names, ISO dates and timestamps, integer cents and millilitres where applicable, and spreadsheet-injection protection for user-entered text.

## Consequences

Reporting v1 can ship without new expense, supplier, picking, or tax records. Every displayed total can reconcile to an existing source record.

The first implementation must correct the Overview’s existing revenue and refund semantics before reusing its financial read model. Phase two can extend the report catalogue without redefining v1 fulfillment and cash facts.
