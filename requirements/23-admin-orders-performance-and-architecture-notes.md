# Admin Orders: Architecture, Debuggability, and Performance Notes

## Purpose

This document records the Admin Orders investigation and the decisions made during implementation. It is intended as source material for a technical article about discovering the problem, evaluating alternatives, improving the system, and validating the result.

The reference implementation is Orders. Other Admin modules should adopt the same principles only after their own behavior and contracts are measured.

## The original problem

The Admin application mixed several concerns in the same page/workspace:

- server-rendered page data;
- client-side filter and pagination state;
- authorization and tenant checks;
- list fetching and refreshes;
- mutation callbacks and dialogs;
- detail/inspector loading;
- navigation badge requests;
- RSC transport requests.

This caused two practical problems:

1. DevTools did not clearly show where the initial Orders data came from. The page could receive order data through an RSC response while the developer expected a JSON request under Fetch/XHR.
2. Some local requests appeared unexpectedly slow or duplicated. List loading, quick counts, authentication, navigation summaries, and RSC navigation were not clearly separated.

The important distinction was:

```text
RSC page request       = UI shell, server rendering, permission-gated props
JSON collection query  = observable Orders data request
JSON counts query      = small navigation/quick-view read model
Navigation summary     = global shell badges, not Orders page data
```

## Decisions and trade-offs

### Keep one Orders concept in the UI

The UI should expose one Orders area with entrypoints for:

- browsing all orders;
- creating a live order;
- recording a historical order.

The code should not become one giant `OrdersWorkspace`. These workflows have different state, permissions, forms, and transitions, so they remain composed in separate ownership areas:

```text
src/app/admin/orders/
  list/
  detail/
  actions/
  types/
src/app/admin/manual-orders/
src/app/admin/manager/orders/
```

This provides unified UX without collapsing unrelated state into boolean-heavy components.

### Use JSON for the Orders collection

The Orders page keeps server-side authentication and permission gating, but the collection is loaded by the client through `GET /api/admin/orders`.

Benefits:

- the actual collection request is visible in Fetch/XHR;
- loading, error, retry, abort, and stale-response behavior have one seam;
- URL filters map directly to an observable request;
- the server page no longer performs a hidden initial collection query.

Trade-off:

- the page has an explicit loading state after reload;
- there is one additional client round trip;
- the UI must handle failure instead of relying on the RSC payload.

The loading state was accepted because request visibility and a single query contract materially improve debugging and maintainability.

### Keep RSC requests

RSC requests were not treated as errors and were not removed. They remain appropriate for the page shell, layout, server permission checks, and navigation. `_rsc` is a Next.js transport parameter, not part of the application API contract.

### Keep named actions for explicit workflows

Resource reads use collection/member routes such as:

```text
GET /api/admin/orders
GET /api/admin/orders/:id
```

Explicit transitions remain named actions where that improves safety and reviewability:

```text
POST /api/admin/orders/:id/status
POST /api/admin/orders/:id/refund
POST /api/admin/orders/batch-archive
POST /api/admin/orders/batch-delete
```

The goal is a clearer REST boundary, not forcing every business transition into a generic PATCH.

## Architecture improvements implemented

### Deep Admin query boundary

Orders collection reads use a typed Admin action boundary:

```text
Request
  -> executeAdmin
  -> authenticate actor
  -> verify permission
  -> construct actor/shop context
  -> getAdminOrders(database, context, query)
  -> success/failure response adapter
```

The query action owns query orchestration, while existing order domain functions retain business ownership. The interface requires actor and shop context, and all order/payment queries remain tenant-scoped.

### Workspace decomposition

The original large workspace was split by workflow ownership rather than by arbitrary file size:

- `orders/list/` owns filters, pagination, URL state, list loading, and table composition.
- `orders/detail/` owns inspector query and detail presentation.
- `orders/actions/` owns bulk, delete, note, detail, and transition controllers.
- `orders/types/` owns the shared Admin order contract.
- `manual-orders/` owns live and historical order creation.
- `manager/orders/` preserves Manager-specific compatibility behavior.

This reduces the chance that a change to list filtering affects detail mutations or Manager behavior.

### URL as source of truth

The Orders URL preserves reloadable application state such as:

```text
view, mode, q, from, to, preset, method, status, source, entry, created, page, limit
```

The implementation distinguishes:

- data filters forwarded to the JSON API;
- UI state restored by the workspace;
- transient parameters such as `created`;
- `_rsc`, which is ignored by the application serializer.

This enables sharing, reload, back/forward navigation, and a direct link to a filtered workspace.

## Performance improvements implemented

### Separate collection data from quick counts

The list request no longer sends `includeCounts=true` and no longer returns quick-view counts. Counts use a dedicated authenticated endpoint:

```text
GET /api/admin/orders/counts
```

This prevents every filter/search/page request from doing count work and makes the DevTools request purpose explicit.

The old `includeCounts` contract was removed from `getAdminOrders` and the Orders route rather than left as an undocumented compatibility path.

### Bounded triage candidate query

Triage is not a simple `COUNT(*)`. It depends on business rules including:

- stale `NEW` orders;
- overdue fulfillment;
- incomplete delivery address;
- missing delivery fee;
- exception statuses;
- payment due for relevant lifecycle states.

The counts query now uses SQL counts for simple categories and loads only candidate orders that can produce triage reasons. Payment aggregation is limited to active order identifiers needed for unpaid/payment-due evaluation. The existing `getOrderTriageReasons` function remains the source of truth for triage semantics.

This avoids loading full order records for the list request and avoids using a second, copied triage implementation in SQL.

### Request-scoped authentication reuse

Admin authentication context is cached by the exact `Request` object in a `WeakMap`.

This is deliberately not a global user/shop cache. It avoids repeated authentication work within one request while preventing cross-request, cross-user, and cross-tenant leakage.

### Navigation summary separation

Navigation badges use:

```text
GET /api/admin/navigation-summary
```

The response contains only the shell counts needed by navigation. The client has in-flight promise deduplication, a `window`-backed short TTL cache, and a 30-second refresh interval while the document is visible.

The endpoint remains separate from Orders collection data. A navigation badge request should not be interpreted as an Orders list request.

### Phase timing logs

Admin execution logs timing information for:

- authentication;
- permission verification;
- application/query execution.

Logs contain route, phase, duration, and correlation ID. They do not contain cookies, tokens, email addresses, order content, or complete query parameters.

## Security impact

The performance work preserves the security boundary:

- every Admin API route remains independently authenticated;
- permission checks remain server-side;
- the browser only receives display flags, never authority;
- every query uses the configured shop scope;
- counts have their own permission contract;
- request-scoped cache entries cannot be reused by another request;
- errors continue through the shared safe production response adapter;
- correlation IDs remain available for failure diagnostics.

The main security failure mode to avoid is a global cache keyed only by URL or resource. Such a cache could return one actor's data to another actor or bypass tenant isolation. The implementation intentionally does not use that design.

## Verification evidence

### Automated checks

The following checks passed during the implementation:

- full Vitest suite: 206 tests passed;
- Orders counts parity test passed against a disposable libSQL database;
- focused Admin/Orders tests passed;
- typecheck passed;
- lint completed with zero errors;
- production build passed.

The repository still reports pre-existing lint warnings, primarily image optimization, URL serializer expression style, and hook dependency warnings. They are not errors introduced by the Orders performance changes.

### Parity coverage

`tests/orders-counts-parity.test.ts` directly compares the optimized quick-count result with the existing domain baseline for:

- overdue NEW triage;
- unpaid and paid orders;
- active and archived counts;
- tenant isolation.

This test is intentionally database-backed rather than only checking a mocked function.

## What remains incomplete

### Browser network verification

The in-app browser confirmed authenticated Orders navigation and URL restoration, but the browser surface did not expose a network-panel API. The following still need manual DevTools or a Playwright/network harness:

- exactly one Orders request after reload;
- exactly one request after each filter/view change;
- JSON content type and response envelope in Fetch/XHR;
- no stale response replacing a newer filter result;
- loading, error, retry, back/forward, and share behavior;
- no unexpected request from login/logout or RSC remount.

### More granular timings

The current `application` timing groups query execution and response preparation. For diagnosing an eight-second local request, the next useful refinement is:

```text
auth
permission
orders-query
counts-query
serialization
response
```

### Remaining compatibility/read paths

Other Admin modules still need the same level of review. The Orders work should be used as a reference, not copied as a generic abstraction. Candidates include Customers, Users, Products, Reviews, Availability, Settings, Audit, and Notifications.

### Quick-search request distinction

The global command palette can issue a separate `/api/admin/orders` request when it searches orders. This is a legitimate workflow request, but a future `/api/admin/order-search` endpoint could make its smaller purpose clearer and prevent it from being confused with the list query in DevTools.

## Rejected approaches

### One generic Admin workspace abstraction

Rejected because it would hide ownership differences behind `mode`, `isManager`, `isHistorical`, and similar booleans. That recreates the original spaghetti structure.

### Global server-side query cache

Rejected because actor, permission, and shop context make a broad cache dangerous. A cache must be request-scoped or have an explicit, audited identity/tenant key.

### Removing all RSC requests

Rejected because RSC remains useful for page shell rendering and server-side access gates. The goal is observable collection data, not eliminating Next.js transport.

### Replacing triage with a simplified SQL predicate

Rejected because it could silently diverge from `getOrderTriageReasons`. Candidate selection plus domain parity preserves business semantics while reducing unnecessary data loading.

### Keeping `includeCounts` indefinitely

Rejected because it leaves two list response shapes and encourages callers to reintroduce expensive count work. The dedicated counts endpoint is clearer and easier to measure.

## Suggested article narrative

1. Start with the symptom: a local request appeared slow and DevTools showed RSC instead of JSON.
2. Separate transport concerns: RSC, collection JSON, counts, and navigation badges.
3. Show why a large workspace made request ownership difficult to see.
4. Explain the chosen deep Admin query boundary and mandatory actor/shop context.
5. Describe the Orders list/count split and the triage candidate strategy.
6. Explain why request-scoped caching is safe while global caching is not.
7. Show the trade-off: explicit loading and an extra counts request in exchange for observability and smaller list work.
8. Present automated evidence and clearly label browser-network verification as remaining work.
9. Close with the rule: reuse principles and contracts, not one generic abstraction for every Admin module.
