# ADR-0008 — v0.0.5 Order Operations, Payments, and Manual Delivery Fees

Status: Accepted for v0.0.5

## Scope

This release adds the minimum protected Manager workflow for operating submitted orders. It keeps the single-shop Manager gate; the later RBAC release controls Staff permissions.

## Decisions

- Existing atomic public reservations and NEW/CONFIRMED/CANCELLED transitions remain the source of truth.
- Manager order detail exposes customer/order snapshots, internal notes, payment records, delivery totals, and pickup confirmation.
- Internal notes and payments are append-only records with shop/order ownership and audit entries. No online payment provider is introduced.
- Payment amounts are positive integer cents and cannot exceed the resolved order total. Delivery orders must receive a manual delivery fee before payment can be recorded.
- Delivery fee is non-negative integer cents, applies only to delivery orders, updates the authoritative final total, and is protected by the order version.
- Pickup confirmation applies only to confirmed pickup orders, is idempotency-protected by the order version, and records actor/time without changing reservation facts.
- Delivery remains “Delivery to be agreed” until an authorized Manager enters the manual fee; no routing provider is called.

## Acceptance

- Manager can list and open order detail, add notes, set delivery fee, record payments, confirm pickup, and transition NEW orders.
- Concurrent stale writes fail without overwriting the order.
- Cancelled orders cannot receive fees or payments; delivery payments cannot be recorded while the fee is pending.
- Existing public ordering, idempotency, capacity reservation, and cancellation tests remain green.
