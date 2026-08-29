# Architecture

## Architectural Style

The application is a modular monolith using Next.js App Router, with feature/domain modules under `src/domain`, route adapters under `src/app/api`, React workspaces under `src/app/admin`, and Drizzle persistence under `src/db`.

The current refactor is deepening Admin modules by making the interface a typed action/query contract. The intended seam is:

```text
Request/page -> auth adapter -> typed Admin action/query -> domain/database -> response/UI adapter
```

## Current Admin Read Flow

Some pages still use:

```text
Server page -> domain/database query -> initial props -> RSC response -> client workspace
```

Other interactions use:

```text
Client workspace -> /api/admin/... -> executeAdmin -> action/query -> JSON response
```

This mixed flow is the source of the Orders debugging problem: initial order data is embedded in RSC while refresh data is JSON.

## Target Deepening

For Orders, the preferred flow is:

```text
Orders page auth/flags -> OrdersListing mount -> GET /api/admin/orders
  -> executeAdmin -> typed order query -> safe JSON response
```

This increases module depth and locality: the route owns adaptation, the query module owns the collection read, and the workspace owns UI state. The deletion test passes if removing the server initial query leaves the page shell and API query intact.

## Reused Patterns

| Pattern | Where | Purpose |
|---|---|---|
| `executeAdmin` | `src/app/api/admin/module.ts` | Shared auth, permission, and execution adapter |
| `AdminActionContext` | `src/domain/admin-action-context.ts` | Mandatory actor/shop context |
| `success`/`failure` | `src/app/api/response.ts` | Stable safe API envelope |
| Compound/provider composition | Admin workspace files | Localize query, selection, and workflow state |
| Domain transactions | `src/domain/orders.ts`, action modules | Preserve business invariants |

## Known Architectural Risks

- Server initial props and client API reads can drift in shape or filter semantics.
- `AdminNavigation` calls dashboard data globally for badges, which can look like an unrelated Orders request.
- Some domain functions still read `env().SHOP_ID` internally instead of receiving shop context directly. [TODO] Complete context propagation.
- Large workspace files remain high-churn and can reduce locality.

## Evidence

- `src/app/api/admin/module.ts`
- `src/app/api/response.ts`
- `src/domain/admin-action-context.ts`
- `src/app/admin/orders/page.tsx`
- `src/app/admin/orders-listing.tsx`
- `src/app/admin/navigation.tsx`
