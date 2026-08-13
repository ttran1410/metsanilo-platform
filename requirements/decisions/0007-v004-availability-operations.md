# ADR-0007 — v0.0.4 Availability and Sold-out Operations

Status: Accepted for v0.0.4

## Scope

This release extends the existing single-shop Manager gate with deployable availability operations. Admin/Manager authority remains represented by the protected Manager route until the later RBAC release.

## Decisions

- Daily capacity remains the source of truth in litres (`capacity_ml`, `reserved_ml`). Customer orders remain litres-only.
- The current business date and future dates inside the product’s inclusive availability window may be edited. Historical dates are immutable.
- Capacity can never be saved below already reserved litres. A capacity edit does not reopen ordering or clear a sold-out override.
- A planner applies one capacity and sold-out state atomically to generated dates. `DAY` generates every date, `WEEK` every seven days, `MONTH` the same calendar day each month, and `CUSTOM` uses an explicit comma-separated date list.
- Missing daily rows are created; existing rows are version-incremented. Product-window, shop, and reservation invariants are checked server-side.
- Manual sold-out requires a private internal reason, is audited, blocks new orders, and is presented publicly exactly like natural exhaustion. Reports continue to use actual orders/reservations.
- Batch planning is intentionally bounded to one product and one date window per command; a future release may add richer templates and permissions.

## Acceptance

- A Manager can plan day/week/month/custom availability and edit today’s row.
- A plan cannot target a historical date, leave the product window, or lower capacity below reserved litres.
- Manual sold-out set/clear is audited and does not alter reservations or order facts.
- Concurrent single-row order reservation behavior remains unchanged and regression tests pass.
