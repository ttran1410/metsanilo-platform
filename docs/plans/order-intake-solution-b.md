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

## Detailed implementation plan

### Phase 0: Baseline and schema verification

1. Confirm the worktree is on a task branch and capture `git status --short --branch`.
2. Read the existing order, availability, customer, audit and outbox helpers before moving code.
3. Verify the actual schema/index definitions for:
   - `orders(shop_id, idempotency_key)` unique constraint.
   - `orders(shop_id, public_reference)` unique constraint.
   - availability uniqueness for `(shop_id, product_id, season_id, business_date)`.
4. If the required indexes already exist, do not create a migration. If not, stop and add a separate migration plan before implementation.
5. Run the current focused order tests to establish a baseline.

### Phase 1: Define canonical idempotency behavior

Implement small pure helpers in `order-intake.ts`:

- `normalizeIdempotencyKey(value)` trims and validates 1–64 characters.
- `buildIdempotencyFingerprint(input, resolvedValues)` includes every persisted request field that can affect the order:
  - channel, shop, locale, product, package, quantity;
  - fulfillment date and method;
  - normalized customer name/contact identifiers;
  - delivery address fields;
  - notes;
  - source, status and delivery fee for external orders;
  - marketing consent for public orders.
- `isSameIdempotentRequest(existing, fingerprint)` compares the stored fingerprint with the incoming one.

The preferred implementation is to persist a deterministic request fingerprint in an existing order metadata/details field only if the schema already supports it. Do not add a schema column in this PR without an explicit migration decision. If no safe persistence location exists, compare all canonical persisted order fields and explicitly document fields that cannot be compared.

Rules:

1. Missing external idempotency key fails validation before any write.
2. Same key and equivalent canonical payload returns the existing order.
3. Same key and different payload returns `IDEMPOTENCY_CONFLICT`/409.
4. A changed external status (`NEW` → `CONFIRMED`) is a conflict, not a replay.
5. Different keys always represent independent order attempts, even when all business fields are identical.

### Phase 2: Make concurrent idempotency replay deterministic

Keep the pre-transaction lookup as a fast path, but treat the transaction as authoritative.

1. Re-check `(shopId, idempotencyKey)` inside the transaction.
2. Perform the order insert using the existing unique constraint as the serialization boundary.
3. Catch a unique violation for the idempotency key only.
4. Re-read the existing row with both `shopId` and `idempotencyKey`.
5. Return replay when the canonical payload matches; otherwise return `IDEMPOTENCY_CONFLICT`.
6. Do not catch unrelated constraint violations as idempotency conflicts.
7. Ensure a losing concurrent transaction rolls back its customer and capacity changes before replay resolution.

If the database driver cannot safely continue the same transaction after a constraint error, use a savepoint/nested transaction if supported, or move the insert into a small retryable transaction boundary. The final behavior must be observable at the domain API, not dependent on raw SQLite error text.

### Phase 3: Make availability auto-provisioning race-safe

In `resolveAndReserveCapacity`:

1. For an override date with no row, insert using conflict-ignore against the availability unique key.
2. Re-read the row using all scope fields, not only the generated id.
3. Reject `manualSoldOut`.
4. Execute the same conditional reservation update for both existing and newly provisioned rows.
5. Map a reservation miss to `CAPACITY_CHANGED`.
6. Add a concurrency test where both requests auto-provision the same date and verify exactly one availability row exists.

### Phase 4: Preserve module boundaries and public behavior

1. Keep `OrderReceipt` and `toReceipt` in `order-intake.ts`.
2. Keep `orders.ts` as the public adapter: parse public input, pass `shopId`, call the core, return `result.receipt`.
3. Keep `operations.ts` as the external adapter: require actor, shopId and idempotency key, call the core, return `result.order`.
4. Ensure `order-intake.ts` never imports `orders.ts`.
5. Preserve busy retry behavior in `submitOrder`.
6. Preserve exact public receipt JSON and existing stable error codes.

### Phase 5: Required regression tests

Add or update tests in `tests/order-intake.test.ts`:

1. Same external key replays without duplicate order, customer, capacity, audit, notification or outbox effects.
2. Same key with changed status returns `IDEMPOTENCY_CONFLICT`.
3. Same key with changed address, notes, fee, source or customer contact returns `IDEMPOTENCY_CONFLICT`.
4. Two identical orders with different keys both succeed.
5. Two concurrent requests with the same key produce one order and one replay/conflict result, never a raw unique-constraint error.
6. Two concurrent override requests for the same missing availability date produce one availability row.
7. Actor email and actor-id fallback are both audited correctly.
8. Actor/shop mismatch and input shop mismatch fail before writes.
9. Override does not bypass `manualSoldOut` or capacity.
10. Failure after reservation restores exact pre-call state.

Update `tests/order-api.test.ts` and `tests/admin-module-contract.test.ts` for:

- unchanged public receipt response;
- required route idempotency key;
- route-derived shop/actor context;
- external `NEW` notification behavior;
- external `CONFIRMED` no-notification behavior;
- unchanged historical order capacity/payment behavior.

### Phase 6: Verification and review gates

Run in order:

```bash
npm run typecheck
npm test tests/order-intake.test.ts
npm test tests/order-api.test.ts
npm test tests/admin-module-contract.test.ts
npm run verify:quick
```

Migration note: this implementation adds nullable `orders.idempotency_fingerprint` in `drizzle/0043_pink_jetstream.sql`. Existing orders remain replayable through the legacy field comparison; new orders persist the canonical fingerprint.

Before completion, review the diff for:

- every order/customer/availability/audit/outbox query being shop-scoped;
- no raw database error leaking through API responses;
- no actor fallback in admin external creation;
- no schema or generated-file changes unless explicitly required;
- no changes to historical order behavior;
- no circular import between `orders.ts` and `order-intake.ts`.
