# Admin JSON Query and Debugability Migration Plan

## 1. Objective

Make Admin workspace data loading observable and consistent in the browser without weakening server-side authentication, permission checks, tenant isolation, or existing SSR behavior where it is still valuable.

The primary target is Orders. After the migration, reloading `/admin/orders` must produce a visible `GET /api/admin/orders` request in DevTools under `Fetch/XHR`, with a JSON response containing the order data. The page RSC request may remain, but it must no longer be the only place where the initial Orders data is delivered.

## 2. Current behavior

The application currently uses two read paths:

```text
Admin page server component
  -> database/domain query
  -> initial props in RSC response

Client interaction or refresh
  -> /api/admin/...
  -> JSON response
```

Orders currently loads its initial data in `src/app/admin/orders/page.tsx` through `listManagerOrdersWithPaymentSummary(db())` and passes it to `OrdersListing` as `initialOrders`. The client-side `refreshOrders()` function calls `/api/admin/orders`, but it is not the initial-load path.

The global `AdminNavigation` also calls `/api/admin/dashboard` to update triage and unread-notification badges. This request is expected on every Admin page and is unrelated to the Orders data request.

The stale `/api/admin/settings` request from `OrdersListing` was corrected to `/api/admin/order-sources` in commit `ff75d13`.

## 3. Scope

### In scope

- Orders initial list loading.
- Typed Admin query contracts and query actions.
- Client loading, error, retry, and stale-request behavior.
- URL filter and pagination parity.
- Products, Reviews, Audit, and Availability list workspaces after Orders is verified.
- Selective detail-page migration where JSON observability materially helps debugging.
- Tests for query shape, permissions, tenant scope, loading behavior, and request duplication.

### Out of scope

- Removing all React Server Components requests.
- Changing business rules or database schema.
- Moving authorization into the browser.
- Replacing CSV/export responses with JSON.
- Migrating every detail page automatically without measuring value.
- Changing global dashboard semantics in the Orders migration.

## 4. Non-negotiable invariants

1. Every Admin API route remains independently authenticated and authorized.
2. The server page remains an early access gate where it already exists.
3. Client-provided permission flags are display controls only; the API remains the security boundary.
4. Every query is scoped to `context.shop.id`.
5. Query actions receive a typed `AdminActionContext` or an equivalent typed Admin query context.
6. API responses continue to use the shared JSON adapter:

   ```json
   { "data": {}, "correlationId": "..." }
   ```

7. Domain errors remain safe for production and preserve stable error codes.
8. No duplicate initial request is introduced.
9. Existing Manager workspace usage of shared components remains compatible.
10. Export endpoints remain intentionally non-JSON where applicable.

## 5. Target architecture

```text
/admin/orders page
  -> server auth and permission flags
  -> render Orders shell

OrdersListing mount/filter change
  -> typed query URL
  -> GET /api/admin/orders
  -> executeAdmin
  -> typed Admin order query action
  -> JSON response adapter
  -> client state
```

The page still uses RSC for the UI shell and permission-gated rendering. The order collection itself is loaded through the observable JSON API.

## 6. Phase 0 — Baseline and contract freeze

### Steps

1. Record the current response shape of `listManagerOrdersWithPaymentSummary(db())`.
2. Record the current response shape of `GET /api/admin/orders`.
3. Compare all fields, including:
   - order fields;
   - payment totals;
   - payment status;
   - archive metadata;
   - status and source fields;
   - historical-entry fields.
4. Document whether API filtering and pagination already match UI state.
5. Add or update focused tests before changing the page.

### Required tests

- Default order query.
- Each supported view.
- Status, method, source, entry, date, search, page, and limit filters.
- Empty result.
- Unauthorized request.
- Missing permission.
- Shop mismatch or cross-shop record ID.
- Stable response envelope.

### Exit criteria

- Current and target response shapes are explicitly documented.
- Existing test suite remains green.
- No UI migration starts before API parity is understood.

## 7. Phase 1 — Typed Orders query action

### Steps

1. Define a typed `AdminOrdersQuery` input containing only supported server filters.
2. Define a typed result for the order list.
3. Add an Admin query action, for example:

   ```ts
   getAdminOrders(database, context, query)
   ```

4. Call `assertAdminActionContext(context)`.
5. Use `context.shop.id` for every order/payment-related predicate.
6. Preserve existing ordering and pagination semantics.
7. Keep business rules in existing order domain functions where possible.
8. Move only query orchestration into the Admin query action; do not create a generic cross-domain query abstraction.
9. Make `GET /api/admin/orders` use the query action.
10. Keep `success(...)` and `failure(...)` response adapters unchanged.

### Exit criteria

- API output is unchanged for equivalent filters.
- Query action has direct unit/integration coverage.
- Route contains no order query implementation details.

## 8. Phase 2 — Orders server page shell

### Steps

1. Keep `adminContext()` and server-side permission checks in `orders/page.tsx`.
2. Keep permission flags:
   - export;
   - create;
   - transition;
   - payment;
   - update;
   - delete;
   - archive.
3. Remove the server-side `listManagerOrdersWithPaymentSummary(db())` call.
4. Remove `initialOrders` from the Orders page-to-client contract.
5. Remove `initialLoadedAt` if it only represents server query time.
6. Keep initial URL state parsing for view/status where it remains useful.
7. Preserve the shared `OrdersListing` contract used by `ManagerWorkspace` until that workspace is migrated separately.

### Exit criteria

- Orders page does not query the order collection directly.
- Server permission checks are unchanged.
- Manager workspace still compiles and renders with its existing initial data path.

## 9. Phase 3 — Orders client initial load

### Steps

1. Replace `useState(initialOrders)` with an empty list plus explicit loading state.
2. Create one `loadOrders()` function for all list reads.
3. Build API query parameters from the canonical filter state.
4. Call `/api/admin/orders` on initial mount.
5. Parse the shared response envelope.
6. Validate that `body.data` is an array or expected query result.
7. Set `loading`, `error`, rows, and `lastUpdated` consistently.
8. Display a loading state without destroying the workspace layout.
9. Display an empty state for successful zero-result queries.
10. Display a friendly error with retry for failed queries.
11. Use `AbortController` or request sequence IDs to prevent stale responses replacing newer results.
12. Cancel or ignore requests after unmount.
13. Reuse the same `loadOrders()` for:
    - manual refresh;
    - post-mutation refresh;
    - filter changes where server filtering is required.
14. Avoid calling `loadOrders()` from both mount and an effect triggered by the same state transition.

### Exit criteria

- Reloading Orders creates `/api/admin/orders` under Fetch/XHR.
- Response content type is JSON.
- Initial, refresh, filter, empty, error, and retry states work.
- No duplicate initial Orders request occurs.

## 10. Phase 4 — Filter and URL parity

### Canonical filter mapping

```text
view    -> server view filter where supported
status  -> status
from    -> from
to      -> to
preset  -> preset or client-only state, explicitly documented
method  -> fulfillment method
source  -> order source
entry   -> live/historical entry type
q       -> search query
page    -> page
limit   -> page size
mode    -> UI-only unless API explicitly needs it
```

### Steps

1. Define which filters are server-side and which are display-only.
2. Ensure the URL is the source of truth for reloadable filters.
3. Ensure `OrdersListing` initializes state from the URL once.
4. Ensure filter changes update the URL and trigger exactly one query.
5. Ensure page changes trigger exactly one query.
6. Ensure changing a filter resets pagination exactly once.
7. Test fixed-date views such as TODAY, TOMORROW, and YESTERDAY.
8. Test ALL and ARCHIVED behavior.
9. Test search plus date/status/source combinations.
10. Confirm that API results match the visible filter labels.

## 11. Phase 5 — Global shell request separation

### Current behavior

`src/app/admin/navigation.tsx` calls `/api/admin/dashboard` for navigation badges on every Admin page.

### Steps

1. Do not treat this as an Orders query failure.
2. Add a clear code comment and optional request header identifying it as a shell badge request.
3. Verify its payload is not unnecessarily large.
4. If needed, create a separate endpoint:

   ```text
   GET /api/admin/navigation-summary
   ```

5. Return only triage and unread counts.
6. Migrate navigation to that endpoint in a separate commit.
7. Keep dashboard page data separate from navigation badge data.

## 12. Phase 6 — Other list workspaces

Migrate one workspace at a time after Orders is verified.

### Products

1. Identify the existing products list API.
2. Add/use a typed Admin products query action.
3. Remove `initialProducts` from the page only after the client loading state exists.
4. Preserve selected product and filters in URL.
5. Keep detail-panel fetches separate from list fetches.

### Reviews

1. Add/use typed review list query action.
2. Move initial list loading to `/api/admin/reviews`.
3. Preserve moderation and mutation action boundaries.
4. Ensure pagination/filter state does not trigger duplicate requests.

### Audit

1. Preserve server authorization and export behavior.
2. Decide whether initial metrics need SSR.
3. Migrate list entries independently from metrics if needed.
4. Keep CSV/JSON export routes as file/download responses.

### Availability

1. Preserve date range initialization.
2. Add typed workspace query action if the current domain query does not already provide one.
3. Migrate only after confirming the client can represent loading/error states for the calendar.

### Customers and Users

1. These already use client fetch more heavily.
2. Normalize their response parsing and error behavior.
3. Avoid unnecessary rewrites if they already meet the JSON-debugability goal.

## 13. Phase 7 — Detail pages

Migrate detail pages selectively, not automatically.

Candidates:

- Order detail.
- Product detail.
- Product edit.

For each candidate:

1. Measure whether RSC initial data is causing a real debugging problem.
2. Keep server permission gate.
3. Add detail query API/action if missing.
4. Add client loading/error/not-found states.
5. Preserve optimistic or mutation refresh behavior.
6. Do not migrate if the added client complexity has no material benefit.

## 14. Testing strategy

### Unit/integration

- Query action input validation.
- Tenant scope.
- Permission denial.
- Result shape.
- Empty result.
- Pagination.
- Filter combinations.
- Correlation ID on failures.

### Component tests/stories

- Loading Orders.
- Empty Orders.
- Error and retry.
- Filter changes.
- Archived view.
- Manager workspace compatibility.

### Browser verification

1. Open DevTools before loading the page.
2. Enable `Preserve log` and `Disable cache`.
3. Select `Fetch/XHR`.
4. Reload `/admin/orders`.
5. Confirm `/api/admin/orders` appears.
6. Confirm response `Content-Type: application/json`.
7. Confirm order data is under `body.data`.
8. Confirm `/api/admin/order-sources` appears separately.
9. Confirm `/api/admin/dashboard` is identified as global shell data.
10. Confirm `/api/admin/settings` is never requested.
11. Change filters and verify exactly one orders request per change.
12. Trigger a mutation and verify refresh uses the same API path.

## 15. Verification commands

Run after each major phase:

```text
npm run typecheck
npm run lint
npm test
```

Run before completion:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Also run repository scans:

```text
rg -n "initialOrders|listManagerOrdersWithPaymentSummary" src/app/admin/orders src/app/admin/orders-listing.tsx
rg -n "fetch\(\"/api/admin/orders|/api/admin/settings" src/app/admin
rg -n "database\.(select|query)|db\(\)\.(select|query)" src/app/api/admin --glob 'route.ts'
```

Expected result after the relevant phases:

- No Orders initial collection query in `orders/page.tsx`.
- `/api/admin/orders` is used by the client initial load.
- No `/api/admin/settings` request remains.
- No direct Admin route query remains where a typed query action has been migrated.

## 16. Rollback plan

If the client migration causes regression:

1. Revert only the workspace migration commit.
2. Restore the previous `initial*` prop contract.
3. Keep the query action and API endpoint changes if they are independently correct.
4. Re-run typecheck, tests, and build.
5. Investigate the failing workspace separately.

Do not revert shared response, permission, or tenant-scope changes together with a UI rollback unless a specific regression requires it.

## 17. Definition of done

The migration is complete when:

- Orders reload visibly uses `/api/admin/orders` as JSON.
- Orders page RSC does not contain the initial order collection as its only data path.
- Auth, permission, tenant scope, and response contracts remain intact.
- No duplicate or stale requests occur.
- Global dashboard badge fetching is documented and not confused with Orders data loading.
- Other workspaces migrated under the same criteria have their own focused verification.
- Full tests, lint, typecheck, and production build pass.

## 18. Architecture review additions

The codebase review adds the following constraints to the implementation:

1. Treat the Orders query as a deep module, not merely a moved `fetch`. Its interface must own filter normalization, shop scoping, pagination, ordering, and result shape so the route and workspace do not duplicate them.
2. Keep page authentication and permission flags server-side. Moving data loading to the browser must never move the security seam.
3. Preserve the existing `OrdersListing` contract used by `ManagerWorkspace` during the first migration. Introduce a separate initial-load mode or wrapper if necessary, then remove the old prop only after both consumers are migrated.
4. Use one client read adapter for initial load, filter changes, refresh, and post-mutation refresh. This creates one observable seam and prevents request behavior from diverging.
5. Add request identity/abort handling before migrating filters. Without it, fast URL changes can let an older response overwrite newer state.
6. Give the query action a test surface independent of React. Test the action with a disposable database, then test the workspace only for loading/error/filter transitions.
7. Keep intentional non-JSON responses explicit: RSC page payloads, CSV exports, and audit downloads must be documented and tested separately.
8. Do not migrate every SSR page automatically. Apply the deletion test per workspace: if removing server initial data concentrates complexity in a clearer JSON query seam, migrate; otherwise retain SSR until the benefit is demonstrated.

## 19. Implementation checkpoint order

The implementation must stop at each checkpoint if behavior or contracts are unclear:

```text
Baseline response comparison
  -> typed Orders query action
  -> API contract tests
  -> Orders client initial load
  -> URL/filter parity
  -> browser Network verification
  -> next workspace decision
```

No Products, Reviews, Audit, Availability, or detail-page migration should begin until the Orders checkpoint proves that the JSON path is observable, permission-safe, filter-correct, and free of duplicate/stale requests.

## 20. Implementation status (2026-08-28)

Completed:

- Orders, Products, Reviews, Audit, Availability, Notifications, Manual Orders, Order detail/edit, and Product detail/edit use observable JSON initial loaders where collection/detail migration is beneficial.
- Orders URL state includes transient `created` handling: success notice, inspector selection, and URL cleanup after the created order is loaded.
- Dashboard badge traffic is separated from workspace collection traffic through navigation summary handling.
- Typecheck, lint, full Vitest suite (29 files / 154 tests), and production build pass.

Still required:

- Browser/E2E verification for Fetch/XHR visibility, reload/share/back-forward, duplicate requests, retry, and stale responses. The repository currently has no Playwright/Cypress harness or browser test script.
- Focused API contract tests for the new detail query variants, permission denial, tenant isolation, response envelope, correlation IDs, and request-scope headers.
- Cross-module URL/transient parameter audit and compatibility-route tests for Settings/operational resources.
- Remaining server-side action migration for Media, Reviews visibility/notifications, and legacy Settings/User/Customer/Contact branches.
- Further workspace decomposition for mutation dialogs and ManagerWorkspace compatibility paths.

## Deferred follow-up

After this implementation plan is complete, verify and finish the complete Orders URL query-state contract. Preserve and restore application parameters such as `view`, `mode`, `q`, `from`, `to`, `preset`, `method`, `status`, `source`, `entry`, `created`, and pagination state across reload/navigation. Data filters must be forwarded to the JSON API; UI-only state such as mode and preset must still restore the correct workspace state. Treat `_rsc` as an internal Next.js transport parameter, not an application parameter. The legacy `created=<orderId>` signal should also regain its success notice and optional selection/opening behavior.

## Cross-module URL and REST contract audit

### Implementation checkpoint (2026-08-28, continuation)

Completed since the previous status entry:

- Users permission, account-action, and profile-editor workflows now live in focused controllers rather than the master-detail workspace.
- Products reorder/archive/delete and editor-save workflows now live in focused controllers.
- Product package mutations and Product Season list/detail queries now use Admin action modules with actor/shop context.
- Reviews PATCH dynamic permission authentication is isolated in a route-specific adapter while preserving the moderate/write distinction.
- Notifications collection reads now use `getAdminNotifications` with an explicit Admin action context.
- Admin execution tests cover permission denial, unauthorized propagation, and actor/shop context.
- Compatibility response tests assert JSON content type, safe error code, and correlation ID.

Current remaining work:

- Expand authenticated route contract coverage from representative routes to every canonical and compatibility endpoint.
- Complete the URL/REST matrix for each module, documenting compatibility query parameters without breaking existing clients.
- Review remaining legacy Settings, Contact, User, Customer, Product, Availability, and Reviews branches for direct domain calls.
- Add browser-level verification; no browser test harness is currently configured.
- Continue decomposition of package/media/season child workflows and ManagerWorkspace compatibility paths only where callbacks still own mutations.

This follow-up should begin now, before migrating additional workspaces. For each admin module, audit and document:

1. Whether the endpoint follows the resource/action distinction expected by REST: collection reads use `GET /resource`, member reads use `GET /resource/:id`, resource mutations use the appropriate method, and explicit workflows such as publish, rollback, refund, or batch operations remain named actions where that improves safety and clarity.
2. Whether request and response shapes match the UI’s actual needs, including pagination metadata, stable error envelopes, field validation errors, permissions, tenant scope, and mutation result freshness.
3. Whether every shareable UI state has a canonical URL representation, with consistent parameter names, defaults, encoding, and removal of transient parameters after they are consumed.
4. Which URL parameters are data filters sent to the API, which are presentation state restored by the workspace, and which are transient notices/selections. Sensitive values must not be placed in URLs.
5. Whether the URL is the single source of truth, avoiding competing server `searchParams`, client `useSearchParams`, local state, and API defaults that can disagree.
6. Whether filter changes are debounced where appropriate, stale requests are aborted or ignored, and browser reload/back/forward/share behavior is covered by tests.

The migration order is Orders as the reference implementation, followed by Customers, Users, Products, Reviews, Availability, Settings, Audit, and Notifications. A module is not considered migrated until its URL contract, API contract, UI mapping, permission behavior, and regression tests agree.
