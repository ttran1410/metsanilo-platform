# METSÄNILO Operations — Admin UX standard

This is the shared presentation and interaction standard for the Operations portal. Domain rules and APIs remain the source of truth; modules should use these patterns consistently.

## Information architecture

- Use **list → detail → edit** for operational records. A module listing is a work queue, not a CRUD form.
- Use dedicated routes for `/new` and `/[id]`. Keep creation and editing out of the listing page, while preserving a clear back link and breadcrumb.
- Every mutation returns visible success/error feedback. After creation, redirect to the list and highlight the new record.
- Keep destructive or irreversible actions behind a confirmation dialog and require a reason where an audit explanation matters.

## List and filter standard

- Desktop tables and mobile cards must expose the same row selection, status, source and action semantics.
- Include a checkbox on every row, a header checkbox for visible rows, and a “select all filtered” action.
- Show a selection toolbar only when rows are selected. The toolbar must show the count and only actions valid for the selected records and the user’s permissions.
- Prefer filter chips/drawers over a dense row of controls. Date filters use a start/end range plus useful presets; preserve the module’s primary date meaning (Orders uses fulfillment date).
- Filter options come from active settings/data. Archived values remain readable on historical records but are not offered for new records.
- Provide clear-all and empty-state feedback. Saved views are appropriate for repeated operational queues.

## Forms and validation

- Labels are above controls; required labels use `*`; errors are inline beside the field and announced in a summary when needed.
- Never block paste. For phone fields use `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`, normalize on blur/submit, and clear the field error as soon as the value changes.
- Reset form-level and field-level errors before every submit. A corrected value must not retain a stale validation error.
- Keep server validation authoritative and return field paths where possible.

## Detail, edit and audit

- `Open`/`View order` means read the detail page; `Edit` is a separate explicit action.
- Status cells may offer inline transitions only when the transition is valid and permitted. Important transitions still require confirmation/reason.
- Use optimistic version checks for edits. Record who changed what and when in the audit timeline.
- Before completion, order item/fulfillment edits recalculate current pricing, allow an agreed-price override with an adjustment reason, and reconcile capacity (release old reservation, check/reserve new capacity, reject atomically when insufficient).
- After `PICKED_UP` or `DELIVERED`, keep the record visible; allow notes and payment corrections only.

## Responsive behavior

- Desktop: table/list with a detail route and sticky selection toolbar.
- Tablet: centered list container with filter drawer.
- Mobile: stacked cards, large touch targets, horizontal filter chips/drawer, and no loss of row selection or actions.

## Permission and feedback

- Hide unavailable actions in the UI and enforce the same permission on the API.
- Use semantic success/error notices, preserve user input on failed submissions, and never silently reset a failed form.

## Phase 0 — canonical operations semantics

The presentation layer must not invent domain states. These labels are the shared vocabulary for tables, cards, filters, detail pages and audit entries.

| Area | Canonical values | Presentation intent |
| --- | --- | --- |
| Order lifecycle | `NEW`, `CONFIRMED`, `PICKING`, `READY`, `OUT_FOR_DELIVERY`, `PICKED_UP`, `DELIVERED` | Operational progress; use success styling only for completed/confirmed work. |
| Closed order states | `CANCELLED`, `REJECTED`, `NO_SHOW`, `CUSTOMER_DECLINED`, `REFUNDED` | Destructive/terminal states; never hide the record from history. |
| Payment | `PAID`, `UNPAID`, `PENDING_FEE`, `PARTIALLY_REFUNDED`, `REFUNDED` | Financial state is independent from fulfillment state. |
| Operational warnings | `CONFLICT_REVIEW`, `CAPACITY_NEAR_LIMIT`, `DELIVERY_ORIGIN_MISSING` | Actionable warning, not a lifecycle status. |
| Order source | Website, SMS, WhatsApp, Facebook Message, or an active configured source | Source describes intake channel; it is not a status. |
| Historical order | `isHistorical`/historical marker | Historical is a record flag, not a source and not a separate lifecycle. |

Customer delivery address is distinct from the pickup location snapshot and delivery-origin snapshot. Snapshots preserve what was agreed at order time; settings describe current defaults only. Prices are recalculated from the current catalog when an order is edited, with an explicit agreed-price override and reason.

### Permission contract

Every visible mutation is permission-gated in both UI and API. Read permissions control visibility of a workspace; write/transition/export permissions control actions. A role grants its default permissions at user creation, while explicit grants may extend (never silently bypass) those defaults. `dashboard.read` is a default read permission for every operational role, including Content Creator, so the landing workspace is never a dead end.

### Phase 1–2 visual contract

- Canvas `#F4F0E7`, surface `#FFFCF6`, muted surface `#E9E4D9`, ink `#1D2822`, muted ink `#657068`, spruce `#17372B`.
- Focus uses a 3px `#C26B35` ring. Success `#2F6B4F`, warning `#B45309`, danger `#9B2E42`, neutral `#4B5563`.
- Editorial serif is reserved for module titles and section kickers; sans-serif is used for data, controls and forms. Currency, references and phone numbers use tabular numerals.
- Controls are at least 44px on desktop and 48px on mobile. No interaction relies on hover alone.
- Desktop uses a persistent grouped sidebar and top utility bar; tablet uses a collapsible navigation drawer; mobile uses a touch-friendly menu with the same information architecture. Navigation must not claim a search or alert count until backed by real data.

## Shared component acceptance checklist

Before a module is considered migrated, verify: route-level list/detail/edit separation; visible success and error feedback; inline field errors and required `*`; row/card parity on mobile; permission-gated actions; semantic status colors; keyboard focus; 44/48px touch targets; loading, empty and error states; and no hardcoded operational counts.

## Phase 3A — foundation primitives

`src/app/admin/ui/primitives.tsx` is the shared entry point for presentation primitives. It intentionally contains no data fetching or domain mutations:

- `AdminCard`, `AdminDataTable` and `AdminRecordCard` for consistent surfaces across desktop/mobile.
- `AdminStatusBadge` for canonical lifecycle/payment/warning tones.
- `AdminFieldError`, `AdminFeedback` and the existing loading/empty states for announced feedback.
- `AdminFilterBar` and `AdminSelectionToolbar` for consistent queue controls.
- `AdminConfirmDialog` for explicit reversible/destructive confirmation.
- `AdminTimeline` for audit/activity presentation.
- `AdminPermissionGate` for rendering an action only when its server-resolved permission allows it.
- `formatAdminMoney` and `formatAdminReference` for locale-safe, tabular operational values.

These primitives are re-exported from `presentation.tsx` during migration so existing modules can adopt them incrementally. A primitive must remain deterministic, accessible, and safe to render on both desktop and mobile; business rules stay in the route/module layer.

## Phase 3B — Orders-specific patterns

Orders uses the primitives as a high-velocity operational queue: quick-view chips, date-range and source filters, a sticky selection toolbar, row-level transition menus, and equivalent mobile cards. The detail route is the command center with a lifecycle stepper, customer contact actions, fulfillment snapshots, customer delivery address, payment/fee controls, exceptions, notes and audit. The edit route presents a capacity delta preview and an explicit price-override/reason flow; the server remains authoritative for atomic capacity and optimistic-version checks.

## Phase 6 — Capacity & harvest planning

`/admin/availability` is a seven-day operations board, not a CRUD form. Each day card aggregates product/date availability rows and shows capacity, reserved volume, remaining litres, utilization and a semantic state: open, near capacity or sold out/locked. Product rows retain package-fit detail and expose explicit Edit and Lock/Reopen actions only when the resolved permission allows them.

- Quick views are **Next 7 days**, **Near capacity**, **Sold out** and **Needs attention**. Empty dates remain visible so missing plans are actionable rather than silently omitted.
- Manual sold-out locking requires a reason and is audited. Reopening is explicit; confirmed reservations cannot be invalidated and the API rejects capacity below already-reserved volume.
- Batch planning provides a client-side date preview for daily, weekly and selected-weekday patterns. The availability API remains authoritative for product windows, conflicts, historical dates, reservations and optimistic versions.
- Picking, pickup-ready and delivery queues are read-only summaries linked to the unified Orders workspace. Capacity remains sourced from the existing availability/order model, so homepage, reserve and Operations use the same remaining-volume and sold-out rules.
- Desktop uses a seven-column board; narrow screens use horizontally scrollable day cards and stacked queue cards. Weather or harvest conditions are captured as a manual reason until a real forecast integration exists.
