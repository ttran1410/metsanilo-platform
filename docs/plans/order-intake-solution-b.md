# Order Intake — Solution B: Atomic Transaction Core & Channel Policy

## Objective

Fix the atomicity and shop-scoping vulnerability in `createExternalOrder` by centralizing public and external order creation in one transaction core. Keep `createHistoricalOrder` completely unchanged in PR 1.

## Frozen policies

| Area | Rule |
|---|---|
| Shop scope | Every core input includes `shopId`. The core rejects `shopId !== env().SHOP_ID` with `FORBIDDEN`/403. Admin input also requires `actor.shopId === shopId`. Routes never accept shop identity from the client; the action context supplies it. |
| Actor | External orders require `AdminActionActor`; canonical actor is `actor.email?.trim() || actor.id`. No `manager`/`public` fallback in admin/domain paths. Public audit actor is `public`. |
| Idempotency | External API requires a client-provided, trimmed key of 1–64 characters. Do not derive keys from business fields. A missing key is a validation error. Same key and same payload replays the existing order with no side effects. Same key with a different payload returns `IDEMPOTENCY_CONFLICT`/409. |
| Date override | `allowDateOverride` bypasses date window, past-date and same-day cutoff, and may auto-provision a missing availability row with 100,000 ml. It never bypasses `manualSoldOut` or atomic capacity enforcement. |
| Capacity | Reservation always uses a conditional update enforcing `reservedMl + volumeMl <= capacityMl`. A failed condition returns `CAPACITY_CHANGED`/409. |
| Pricing | Pickup always persists fee `0` and total `subtotal`. Delivery persists fee and total only when a non-negative fee is supplied; otherwise both are `null`. |
| Confirmation | External `CONFIRMED` sets `contactedAt`, canonical `contactedBy`, and `contactChannel = source`. Missing delivery fee is valid, but handover transitions remain blocked until resolved. |
| Notifications | Public orders and external `NEW` orders create `notifications` and `NEW_ORDER` outbox jobs. External `CONFIRMED` creates neither. |
| Historical | No implementation or behavior change to `createHistoricalOrder` in PR 1; it must not reserve capacity. |

## Core contract

Create `src/domain/order-intake.ts` with:

- `OrderReceipt` and `toReceipt`.
- `PublicOrderChannelInput` with required `shopId` and `idempotencyKey`.
- `ExternalOrderChannelInput` with required `shopId`, `actor`, and `idempotencyKey`.
- `intakeOrderCore(database, input): Promise<{ receipt: OrderReceipt; order: typeof orders.$inferSelect }>`.

The core must:

1. Validate shop scope and actor/shop consistency before database work.
2. Normalize and validate the idempotency key.
3. Check idempotency before and inside the transaction.
4. Resolve active shop-scoped catalog, quantity, volume and subtotal.
5. Resolve date/season/availability and reserve capacity atomically.
6. Snapshot the active default pickup/delivery location.
7. Normalize and upsert the customer with deterministic conflict handling.
8. Insert the complete order row once, including source, pricing, status and confirmation fields.
9. Insert status-appropriate notification/outbox records in the same transaction.
10. Insert audit records in the same transaction.
11. Return the inserted/replayed order and receipt.

Avoid a dependency from `order-intake.ts` back to `orders.ts`; `orders.ts` may re-export `OrderReceipt` and adapt `result.receipt` for `submitOrder`.

## File changes

- **New:** `src/domain/order-intake.ts` — core, helpers, receipt type and adapter.
- **Modify:** `src/domain/orders.ts` — delegate `submitOrder` to the public channel; preserve busy retry and exact receipt JSON.
- **Modify:** `src/domain/operations.ts` — delegate `createExternalOrder`; require actor, shopId and idempotencyKey; remove post-commit updates/lookups.
- **Modify:** `src/domain/admin-order-operations-actions.ts` — pass `context.actor` and `context.shop.id`; retain permission check for date override.
- **Modify:** `src/app/api/admin/orders/external/route.ts` — require `idempotencyKey: z.string().trim().min(1).max(64)`; do not accept `shopId` or actor from request body.
- **New:** `tests/order-intake.test.ts` — focused core tests.
- **Modify:** `tests/order-api.test.ts` — backward compatibility and external regression coverage.

## Acceptance criteria

1. Mismatched `shopId`, or actor/shop mismatch, returns `FORBIDDEN`/403 without writes.
2. Same external idempotency key and equivalent normalized payload replays the same order with no duplicate reservation, customer update, audit, notification or outbox records.
3. Same key with a materially different payload returns `IDEMPOTENCY_CONFLICT`/409.
4. Two otherwise identical legitimate orders with different idempotency keys both remain possible.
5. Any failure after reservation rolls back order, customer, capacity, audit, notification and outbox changes.
6. Date override bypasses only date/cutoff rules; `manualSoldOut` and capacity remain enforced.
7. Concurrent reservations for the last capacity allow exactly one success and leave `reservedMl` within capacity.
8. External actor audit uses email when present and actor id otherwise.
9. External `NEW` creates `NEW_ORDER` notification/outbox; external `CONFIRMED` creates neither.
10. Pickup and delivery pricing match the frozen pricing matrix.
11. Public `submitOrder` returns byte-for-byte compatible receipt shape.
12. Historical order creation leaves availability and payment/capacity semantics unchanged.

## Verification

```bash
npm run typecheck
npm test tests/order-intake.test.ts
npm test tests/order-api.test.ts
npm test tests/admin-module-contract.test.ts
npm run verify:quick
```

Before implementation, verify that the existing schema has shop-scoped unique indexes for `(shop_id, public_reference)` and `(shop_id, idempotency_key)`. If either is absent, add a migration; otherwise this PR requires no schema change.

Rollback tests must compare exact pre-call state rather than assume empty fixtures. Use a deterministic test-only failure seam or controlled constraint failure; do not rely on an impossible typed status value.
