# Codebase Concerns

## Top Risks

| Severity | Concern | Evidence | Impact | Suggested action |
|---|---|---|---|---|
| High | Orders initial data is delivered through RSC while refresh uses JSON API | `src/app/admin/orders/page.tsx`, `src/app/admin/orders-listing.tsx` | Harder browser debugging and possible read-shape drift | Migrate Orders initial load to `/api/admin/orders` first |
| Medium | Global navigation fetches dashboard on every Admin page | `src/app/admin/navigation.tsx` | Looks like unrelated module traffic and may be heavier than needed | Consider a small navigation-summary query later |
| Medium | Some domain functions read `env().SHOP_ID` internally | `src/domain/orders.ts`, `src/domain/notifications.ts`, `src/domain/products.ts` | Context interface is less explicit and harder to test for tenant scope | Propagate shop context incrementally |
| Medium | Large mixed-responsibility workspace files | `src/app/admin/orders-listing.tsx`, `src/app/admin/settings.tsx` | Low locality and higher regression risk | Continue compound composition refactor |
| Low | Better Auth secret warning | build output, `src/lib/env.ts` | Production security weakness if not corrected | Use random secret of at least 32 characters |

## Technical Debt

- The new query/action wrappers sometimes delegate to legacy domain functions whose interface still uses env-based shop scope.
- [TODO] Add a shared client JSON parser with runtime envelope validation.
- [TODO] Add browser-level regression coverage for RSC versus Fetch/XHR behavior.

## Security Concerns

- API authorization remains the required security boundary; client permission flags must not be trusted.
- All new query actions must assert actor/shop context and use `context.shop.id` in predicates.
- Export responses are intentionally non-JSON and require separate content-type tests.

## Fragile Areas

- Orders and Admin navigation are high-churn areas based on recent git history.
- `OrdersListing` is shared by the main Orders page and Manager workspace; changing its initial-data contract can affect both.
- Product detail/edit pages have separate server queries and should not be bulk-migrated without contract comparison.

## [ASK USER] Questions

1. [ASK USER] Should the project migrate only Orders first, or require all Admin list workspaces to use client JSON loading in one release?
2. [ASK USER] Is an extra client loading state acceptable on Admin reloads?
3. [ASK USER] Should the global dashboard badge request be split into a lightweight navigation-summary endpoint?

## Evidence

- `src/app/admin/orders/page.tsx`
- `src/app/admin/orders-listing.tsx`
- `src/app/admin/navigation.tsx`
- `src/domain/admin-action-context.ts`
- `npm test` output: 20 files, 126 tests passed
