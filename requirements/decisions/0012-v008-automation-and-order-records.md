# ADR-0012 — v0.0.8 Durable Automation and Order Records

Status: Accepted for v0.0.8

## Scope

This release adds durable outbox-backed operational automation and protected Manager APIs for external and historical order records. Operational reminders are internal notifications; customer messaging remains manual and no automatic customer email is sent.

## Decisions

- `outbox_jobs` uses a shop-scoped unique event key so retries are idempotent.
- The automation runner is safe to invoke repeatedly. At/after 10:00 in the shop timezone it transitions today’s `CONFIRMED` orders to `PICKING`; at/after 19:00 it creates one internal ready-review notification per today’s `PICKING` order; orders `NEW` for at least 15 minutes create one internal overdue reminder.
- System transitions use actor `system`; human transitions retain Manager/Staff audit attribution.
- Public order creation stores a customer match (or a `CONFLICT_REVIEW` customer record when mobile/email identifiers disagree). It does not queue a customer email event.
- Admin/Manager can configure enabled payment methods, including MobilePay. The system always retains at least one enabled method; payment recording rejects disabled methods.
- External orders reuse the same product, price, quantity, capacity, and lifecycle rules as public orders and record `PHONE` or `OTHER` source.
- Historical completed orders create immutable snapshots without modifying historical availability and require a reason/evidence note.
- Payments distinguish `PAYMENT` and `REFUND`; refunds cannot exceed cumulative payments. Partial refunds retain `PICKED_UP`/`DELIVERED`, while the final cumulative refund transitions the order to `REFUNDED`.

## Deferred

SMTP/provider transport, customer merge resolution, multi-line external orders, configurable cutoff settings, and durable cron infrastructure remain follow-up deployment work. The runner is invoked through a protected endpoint or platform scheduler.
