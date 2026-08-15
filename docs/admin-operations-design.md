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
