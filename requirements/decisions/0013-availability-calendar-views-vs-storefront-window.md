# 0013 — Availability Date Anchoring: Calendar Views vs. Storefront Window

- **Status:** Accepted
- **Date:** 2026-08-21
- **Scope:** Admin availability workspace (Week/Month/Table views), storefront availability window

## Context

The admin availability Week view rendered "today + 6 days" while its pager claimed a
Mon–Sun week. Root cause: the server anchored availability reads to *today* by default,
while the client pager assumed calendar weeks. Investigation surfaced two distinct,
intentional date models in the product:

1. **Admin operations** plans capacity and fulfillment per **calendar periods**
   (weeks Mon–Sun, calendar months). Staff think in business weeks; navigation is
   period-by-period.
2. **Storefront customers** convert best with a **rolling window starting today**.
   They cannot order past days, and showing Mon–Sun on (say) a Friday would surface
   already-full weekend days or dead past days before reachable capacity — leaking orders.

## Decision

1. **Server is the single source of truth for view dates.**
   `src/app/admin/availability/page.tsx` anchors the initial fetch per requested view:
   - `WEEK` → Monday of the selected week (`getStartOfWeek`), 7 days
   - `MONTH` → first of the month (`getStartOfMonth`), days-in-month count
   - `TABLE` → the requested start date as-is, rolling 30 days
   Deep-linked or default requests are normalized server-side; the client adopts
   `initialWorkspace.startDate` instead of recomputing from the browser clock.

2. **Shop timezone owns "today".**
   The availability payload now includes `today` (computed via the shop's timezone).
   Client-side past-date highlighting uses it rather than the browser clock.

3. **The storefront keeps the rolling 7-day-from-today window.**
   No calendar-week behavior is introduced customer-side; this asymmetry is deliberate
   (operations planning vs. conversion).

## Consequences

- Week/Month/Table deep links (`?view=…&startDate=…`) render complete, correctly
  sized windows on first paint.
- Date math disagreements between browser timezone and shop timezone can no longer
  desynchronize server data from client state.
- Any future feature that links into the availability workspace should link with
  `?startDate=…&view=…` and let the server normalize, not compute dates client-side.
- Storefront changes must preserve the rolling-window rule; reintroducing calendar
  weeks there is a product decision, not a refactor.
