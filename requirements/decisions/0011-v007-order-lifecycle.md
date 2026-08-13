# ADR-0011 — v0.0.7 Order Lifecycle and Fulfillment

Status: Accepted for v0.0.7

## Scope

This release replaces the pilot’s three-state order operation with the canonical manual fulfillment lifecycle. Durable scheduler/outbox automation and reminders remain deferred until this state machine is proven in production.

## Canonical states and transitions

- `NEW → CONFIRMED | CUSTOMER_DECLINED | CANCELLED`
- `CONFIRMED → PICKING | CANCELLED | CANCELLED_BY_CUSTOMER`
- `PICKING → READY | CANCELLED | CANCELLED_BY_CUSTOMER`
- `READY → PICKED_UP | OUT_FOR_DELIVERY | CANCELLED | CANCELLED_BY_CUSTOMER | REJECTED | NO_SHOW`
- `OUT_FOR_DELIVERY → DELIVERED | CANCELLED_BY_CUSTOMER | REJECTED | NO_SHOW`
- `PICKED_UP → REFUNDED` and `DELIVERED → REFUNDED`

Every terminal decline/cancellation/rejection/no-show/refund transition requires a reason. Pickup and delivery transitions enforce the fulfillment method and resolved total.

## Capacity

Reservation occurs once at order creation. Cancellation/decline releases capacity only from `NEW` or `CONFIRMED`; once picking begins, later terminal outcomes preserve historical consumption.

## Evidence

Order rows store status reason, contact channel/time, fulfillment start, ready, dispatch, and completion timestamps. Each transition is version-checked and audited; replaying a transition is rejected without changing capacity twice.
