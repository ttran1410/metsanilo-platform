# ADR-0012 — v0.0.8 Durable Automation and Order Records

Status: Accepted for v0.0.8

## Scope

This release adds durable outbox-backed operational automation and protected Manager APIs for external and historical order records. The outbox is provider-neutral: email notifications are queued durably for a later email transport configuration.

## Decisions

- `outbox_jobs` uses a shop-scoped unique event key so retries are idempotent.
- The automation runner is safe to invoke repeatedly. At/after 10:00 in the shop timezone it transitions today’s `CONFIRMED` orders to `PICKING`; at/after 19:00 it queues one ready-review email event per today’s `PICKING` order; orders `NEW` for at least 15 minutes queue one overdue reminder event.
- System transitions use actor `system`; human transitions retain Manager/Staff audit attribution.
- Public order creation queues an order-created email event when an email exists. No provider is called by the transaction.
- External orders reuse the same product, price, quantity, capacity, and lifecycle rules as public orders and record `PHONE` or `OTHER` source.
- Historical completed orders create immutable snapshots without modifying historical availability and require a reason/evidence note.
- Payments distinguish `PAYMENT` and `REFUND`; refunds cannot exceed cumulative payments. Partial refunds retain `PICKED_UP`/`DELIVERED`, while the final cumulative refund transitions the order to `REFUNDED`.

## Deferred

SMTP/provider transport, customer search/merge, multi-line external orders, configurable cutoff settings, and durable cron infrastructure remain follow-up deployment work. The runner is invoked through a protected endpoint or platform scheduler.
