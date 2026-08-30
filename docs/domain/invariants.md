---
last_updated: 2026-08-30
document_type: reference
---

# Domain rules and invariants

This current-state reference identifies business facts maintainers must preserve. Executable domain code and tests remain the implementation evidence. Use [Current product scope](current-product-scope.md) to distinguish shipped, partial, deferred, and unknown capabilities before treating a request as an existing contract.

## Shop isolation and units

Every read/write must be scoped to `env().SHOP_ID`; action contexts additionally assert actor/shop consistency. Money is integer cents; volume and capacity are integer millilitres. Dates are business dates interpreted using the configured shop timezone, not the browser timezone.

## Orders and capacity

- Public order input is normalized and validated before persistence (`src/domain/order-input.ts`).
- Order creation, edits, status transitions, payment, refunds, deletion, and capacity changes use database transactions in `src/domain/orders.ts` and related admin actions.
- Capacity is reserved/released in millilitres and guarded by availability flags, remaining capacity, and conditional updates. A failed conditional update is a conflict, not a reason to retry blindly.
- Mutable order operations use `orders.version`/`expectedVersion`; stale writes return `STALE_VERSION`.
- Idempotency keys are shop-scoped and must not cause duplicate order/capacity effects. [TODO] Document exact idempotency retention/cleanup; it is not established by inspected implementation.
- Lifecycle transitions are centralized in `src/domain/order-transitions.ts`; fulfillment method and unresolved delivery fees constrain legal transitions.
- Paid orders cannot be deleted; refunds cannot exceed paid amounts; delivery orders require a resolved delivery fee before applicable handover states.

## Availability and catalog

Products/packages/availability are shop-scoped. Public catalog visibility depends on active product/package, homepage/reserve flags, seasonal dates, availability, and same-day cutoff behavior. `manualSoldOut`, `acceptsOrders`, capacity, and cutoff overrides jointly determine whether an availability row accepts orders. Keep existing calculations in `src/domain/availability.ts` and `src/domain/capacity.ts`.

## Identity, reviews, and retention

Customer records can be normalized/matched by contact information and may enter `CONFLICT_REVIEW`. Marketing consent and contact-confirmation fields are auditable. Customer anonymization/retention operations are sensitive and must preserve legal/audit requirements.

Reviews retain `originalText` separately from public `displayText`; publication status, acknowledgement, verification type, moderation actor/time, and seller replies are separate facts. Never overwrite legal/audit text merely to change public presentation.

## Authorization and audit

`ADMIN` and `MANAGER` currently receive broad permission behavior in `src/domain/access.ts`; other roles use explicit grants from `user_permissions` plus defaults in `src/lib/permissions.ts`. High-risk operations and user changes must retain existing permission and audit paths. A navigation item being hidden is not authorization.

Evidence: `src/domain/order-input.ts`, `src/domain/orders.ts`, `src/domain/order-transitions.ts`, `src/domain/availability.ts`, `src/domain/capacity.ts`, `src/domain/customers.ts`, `src/domain/reviews.ts`, `src/domain/access.ts`, `src/lib/permissions.ts`, `src/db/schema.ts`, and matching tests.
