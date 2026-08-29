# Admin Module Migration Plan

## Scope and branch policy

This plan continues on `feature/split-admin-workspaces`. All module improvements are intentionally accumulated on this branch. Do not create a PR into `main` until every phase below is complete and the final release gate passes.

Orders is the reference implementation for boundaries and verification. It is not a generic abstraction to copy into every module.

## Reference principles from Orders

Each module must be evaluated independently against these principles:

1. Server-side authentication and permission checks remain the security boundary.
2. Every domain query/action receives typed actor and shop context.
3. Collection reads use a typed JSON query contract when browser observability materially helps.
4. URL state is explicit and distinguishes data filters, UI state, and transient parameters.
5. One client loader owns initial load, filter changes, refresh, abort, stale response handling, and errors.
6. Counts/summary data is separate from collection data when it has different freshness or cost.
7. Workspaces are decomposed by ownership, not by arbitrary file length.
8. Named business actions remain named where they improve safety and reviewability.
9. Compatibility paths are preserved until all consumers are migrated and tested.
10. Each module gets parity, permission, tenant, and response-envelope tests before the next module begins.

## Global rules

Do:

- preserve existing URLs unless a compatibility mapping is documented;
- keep `env().SHOP_ID` or the typed shop context in every database predicate;
- use `failure(error, request)` and safe production errors;
- keep `_rsc` outside the application contract;
- add focused tests before or with each migration;
- commit one coherent workflow at a time;
- run typecheck and focused tests after each module slice.

Do not:

- create a generic `AdminWorkspace` or universal query cache;
- move authorization into React;
- merge unrelated module migrations into one large refactor;
- remove SSR merely to make architecture look uniform;
- cache actor, permission, or tenant data globally;
- move Manager components into Admin module folders only because they use the same records;
- delete compatibility routes before repository-wide consumer checks.

## Phase 0 — Orders hardening gate

Before changing another module, record the remaining Orders verification as a hardening checklist:

- manual DevTools verification of one Orders request per reload/filter/view;
- JSON content type and response envelope;
- no stale response after rapid filter changes;
- loading/error/retry behavior;
- back/forward/share/reload URL behavior;
- Manager Orders, Manual Orders, detail inspector, and command-search request distinction;
- optional phase timing split: auth, permission, query, counts, serialization, response.

These checks may be completed alongside later planning, but they must be closed before the final `main` PR.

## Phase 1 — Customers

### Why first

Customers already use client fetch heavily and have a clear master/detail workflow. They are the lowest-risk next reference for removing duplicate loaders.

### Discovery

1. Map `customers/page.tsx`, master-detail workspace, inspector, toolbar, saved views, and action controllers.
2. List every `/api/admin/customers` collection/member request and compatibility path.
3. Identify whether the page still supplies initial customer data through RSC.
4. Record response fields, pagination, search, filters, selected customer, profile, contacts, and retention state.
5. Identify duplicate request causes: initial loader, URL synchronization, selected-record effect, or remount.

### Implementation

1. Define `AdminCustomersQuery` and a typed result contract.
2. Make `GET /api/admin/customers` use the Admin query boundary with actor/shop context.
3. Separate collection data from customer detail/profile data.
4. Make URL state the source of truth for search, filters, page, and selected customer ID.
5. Use one abortable client loader for initial load, filter changes, refresh, and mutation refresh.
6. Remove only the redundant server collection query after loading/error UI exists.
7. Keep member detail and mutation permissions server-side.
8. Preserve privacy/retention invariants and avoid putting sensitive customer data in URLs.

### Tests and exit criteria

- response parity and pagination;
- auth and permission denial;
- tenant isolation for collection and member IDs;
- correlation ID, request-scope header, malformed input;
- one request per filter/selection transition;
- loading, empty, error, retry, back/forward behavior;
- no duplicate initial collection loader.

## Phase 2 — Users

### Why second

Users have the strongest authorization sensitivity. The existing decomposition provides controllers/dialogs, but role and permission updates need especially explicit contracts.

### Discovery

1. Map user list, profile editor, onboarding/invite, password, permission editor, and confirmation dialogs.
2. Identify every role/permission mutation and self-downgrade rule.
3. Identify Better Auth versus legacy session paths.
4. Verify email read-only behavior and client/server validation parity.

### Implementation

1. Define typed user list/profile query contracts.
2. Keep email immutable in profile updates; reject submitted email-change fields with a stable validation/forbidden error.
3. Enforce self-downgrade prevention in the domain/action layer.
4. Disable the self-edit role field in UI for Admin and Manager, while retaining API enforcement.
5. Normalize invite/create email with trim, lowercase, friendly format validation, and identical server/UI behavior.
6. Ensure permission editor actions receive actor and shop context.
7. Remove duplicate user loaders only after route and browser parity tests exist.

### Tests and exit criteria

- Admin/Manager self-role downgrade denial;
- cross-shop user read/update denial;
- email immutability and malformed email;
- invite normalization;
- permission denial and role-specific visibility;
- response envelope/correlation/request-scope contracts;
- dialog actions do not own direct mutation fetches.

## Phase 3 — Products

### Why third

Products contain several child workflows with different ownership: product editing, packages, media, seasons, pricing, and availability links.

### Discovery

1. Map product collection/detail/edit pages and all child tabs/dialogs.
2. Identify collection, detail, package, media, season, pricing, and reorder requests.
3. Mark which types have at least two consumers before moving them to `products/types`.
4. Separate product list state from child workflow state.

### Implementation

1. Define the product collection query contract and URL matrix.
2. Keep product detail fetches separate from list fetches.
3. Keep package, media, and season actions in focused workflow controllers.
4. Move domain transitions out of workspace callbacks while keeping presentation dialogs local.
5. Preserve product, package, season, and media permission boundaries.
6. Use query-specific cache keys only for safe, non-sensitive data; never cache auth context globally.

### Tests and exit criteria

- product list/filter/pagination parity;
- product/package/season/media tenant isolation;
- mutation permission and malformed input;
- stale response protection when switching selected products;
- no duplicate child query after tab changes;
- shared types moved only when there are multiple real consumers.

## Phase 4 — Availability

### Why fourth

Availability has transition complexity and date/view state (`week`, `month`, `table`) that can cause visible flicker and duplicate loads.

### Discovery

1. Map calendar, week/month/table view, date navigation, capacity editor, freeze/cutoff, batch planner, and duplicate detection.
2. Record canonical URL state and date anchoring rules.
3. Identify requests triggered by view changes, date changes, and initial server props.
4. Measure whether old data remains visible while a new range loads.

### Implementation

1. Define a typed availability range query with explicit `view`, `startDate`, and range semantics.
2. Make URL state drive view/date selection.
3. Abort or ignore previous range requests before rendering the new range.
4. Use a stable loading shell to avoid showing multiple stale weeks/months during transitions.
5. Keep capacity/freeze/cutoff mutations in action controllers with version checks.
6. Keep batch planning as an explicit workflow, not a generic calendar mutation.

### Tests and exit criteria

- Monday week anchoring and month range parity;
- rapid week/month/table changes do not show stale final state;
- one request per range transition;
- version conflict and tenant isolation;
- loading/error/retry behavior;
- calendar mutation response freshness.

## Phase 5 — Reviews

### Discovery and implementation

1. Verify whether Reviews still has parallel SSR default loading and client JSON loading.
2. Define a typed Reviews query contract for filters, pagination, visibility, and identity linking.
3. Keep moderation, visibility, notification, reply, and identity workflows as separate actions.
4. Isolate dynamic permission branches in route-specific adapters.
5. Ensure filter changes cancel stale requests and do not trigger a second default query.

### Tests and exit criteria

- SSR/client parity;
- visibility and notification permission branches;
- tenant isolation for review/order/customer links;
- moderation response envelope and malformed input;
- one request per filter change;
- safe handling of public versus Admin review data.

## Phase 6 — Settings and operational resources

Review each resource separately:

- payment methods;
- fulfillment locations;
- order sources;
- storefront theme drafts/versions;
- contact/operational compatibility paths.

For each resource:

1. Confirm collection/member/action REST shape.
2. Preserve named actions such as publish, rollback, and delete where appropriate.
3. Define permission and shop context at the route boundary.
4. Normalize response/error envelopes.
5. Test compatibility routes before removing legacy behavior.
6. Ensure Settings requests do not occur when visiting Orders or unrelated modules.

## Phase 7 — Audit and Notifications

### Audit

- Keep export/download responses intentionally non-JSON.
- Use a typed list query for audit entries.
- Preserve actor/shop filters and redaction.
- Ensure `_rsc` is not treated as an audit filter.
- Test access denial, tenant scope, pagination, and correlation IDs.

### Notifications

- Separate unread summary from notification collection.
- Keep `notifications.read` permission on both summary and collection routes.
- Deduplicate summary requests and avoid polling while the document is hidden.
- Test mark-read/unread freshness and cross-tenant isolation.

## Phase 8 — Global verification

### Repository scans

Run targeted scans after each module:

```bash
rg -n "initial[A-Z]|listManager|database\.(select|query)|db\(\)" src/app/admin/<module> src/app/api/admin --glob 'route.ts'
rg -n "fetch\(.*api/admin|useEffect|useSearchParams|router\.replace" src/app/admin/<module>
```

Review every result manually; a match is not automatically a defect.

### Required automated gate

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Run commands sequentially because `typecheck` reads generated `.next` types and can race with `build` if run concurrently.

### Browser gate

For each migrated module:

1. Open DevTools with Preserve log and Disable cache.
2. Select Fetch/XHR.
3. Reload the canonical URL.
4. Confirm the expected JSON endpoint and response envelope.
5. Confirm no unexpected module/settings/dashboard collection request.
6. Change filters/views rapidly and verify one current request and no stale UI.
7. Verify loading, empty, error, retry, share, reload, back, and forward behavior.

## Commit and PR policy

- Commit each coherent module/workflow slice.
- Do not create a PR into `main` during intermediate phases.
- Keep generated files such as `next-env.d.ts` out of commits.
- Before PR creation, confirm the branch contains all intended module improvements and no unrelated changes.
- Final PR target: `main`.

## Definition of done

The branch is ready for a PR into `main` only when:

- each module has an explicit URL/API/UI ownership decision;
- migrated reads have typed actor/shop context;
- permissions and tenant tests pass;
- no known duplicate/stale loader remains in migrated workflows;
- compatibility paths are documented and tested;
- Orders hardening and browser verification are closed;
- full tests, lint, typecheck, and production build pass;
- the final diff is reviewed for accidental generic abstractions or security-boundary movement.
