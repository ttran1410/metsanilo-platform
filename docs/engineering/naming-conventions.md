---
last_updated: 2026-09-11
document_type: reference
---

# Naming and file conventions

These conventions are repository policy. They consolidate patterns evidenced in the codebase with the accepted Admin naming notes previously held in internal requirements. Apply them to new code and to files already being changed; do not perform repository-wide renames merely for conformance.

## Language-level names

| Construct | Convention | Examples |
|---|---|---|
| Variables and functions | descriptive `camelCase` | `remainingMl`, `parseAdminListQuery`, `createOrder` |
| React components, classes, types, interfaces | descriptive `PascalCase` | `OrdersWorkspace`, `AdminActionContext`, `OrderInput` |
| React hooks | `use` + PascalCase concept | `useOrderListQuery`, `useMediaGalleryController` |
| True module constants | `UPPER_SNAKE_CASE` | `CACHE_TTL_MS`, `PERMISSION_GROUPS` |
| Zod schemas | camelCase ending in `Schema` | `envSchema`, `orderInputSchema`, `querySchema` |
| Boolean values | positive predicate where practical | `acceptsOrders`, `canManage`, `isLocale` |
| Event callbacks | `on...`; local event handlers | `onRefresh`, `handleSubmit` |
| Domain commands/queries | explicit verb + business concept | `transitionAdminOrder`, `listPublishedReviews` |

Avoid vague exported names such as `data`, `item`, `process`, `manager`, `handleAction`, or `doUpdate`. A local short name is acceptable only when its scope makes the meaning obvious.

## Domain suffixes

Names must expose units and semantics:

- identifiers end in `Id`, such as `shopId`, `orderId`, and `productId`;
- monetary integer values end in `Cents`;
- volume and capacity integer values end in `Ml`;
- timestamps end in `At` and are ISO timestamp strings unless the type says otherwise;
- business calendar dates end in `Date` and use `YYYY-MM-DD`;
- versioned writes use `version` or `expectedVersion`;
- raw database records may end in `Row`; boundary inputs in `Input`; runtime context in `Context`; UI state in `State`.

Do not use a unitless name when the value could be confused (`price`, `capacity`, `date`). Do not translate persisted enum/status codes; keep them stable and translate display labels at the presentation boundary.

## Files and directories

- Use lowercase kebab-case for non-framework files and directories: `availability-resolver.ts`, `order-query-loader.tsx`.
- Use `.tsx` only when the file contains JSX; otherwise use `.ts`.
- Tests end in `.test.ts` or `.test.tsx`; Storybook files end in `.stories.tsx`.
- Next.js reserved entrypoints retain framework names: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, and `route.ts`.
- Use singular nouns for one entity/contract and plural nouns for collections or workspaces: `order-detail.ts`, `orders-workspace.tsx`.
- Include the domain in a filename whenever the name would otherwise be ambiguous.
- Avoid generic filenames such as `view.tsx`, `workspace.tsx`, `helpers.ts`, `utils.ts`, `actions.ts`, `loader.tsx`, or `types.ts`, unless a narrowly named containing folder makes the responsibility unambiguous.

## Admin module contract

| Responsibility | Folder or filename |
|---|---|
| Next.js route | reserved framework filename; composition only |
| Route-to-feature adapter | `<domain>-module.tsx` |
| Workflow owner | `<domain>-workspace.tsx` |
| Read/query boundary | `<domain>-query-loader.tsx` or `query/use-<domain>-query-controller.ts` |
| List workflow | `list/` |
| Detail/inspector workflow | `detail/` |
| Typed admin command boundary | `actions/<domain>-admin-actions.ts` |
| React action orchestration | `actions/use-<domain>-<action>-controller.ts` |
| Dialog or drawer | `dialogs/<domain>-<purpose>-dialog.tsx` or `drawers/<domain>-<purpose>-drawer.tsx` |
| Shared contract | `types/<domain>-<concept>.ts` |
| URL contract | `url-state.ts` |
| Proven legacy adapter | `compatibility/<legacy>-<domain>-entrypoint.tsx` |
| Multi-feature Admin runtime | `shared/<purpose>.ts` |
| Multi-feature Admin UI | `ui/admin-<purpose>.tsx` |

`page.tsx` must remain thin. A file may move to `shared/` only after a second real consumer exists. A compatibility filename requires a verified legacy consumer and must remain logic-free.

## Database and API names

TypeScript schema properties use camelCase while explicit SQLite column names use snake_case, following `src/db/schema.ts`. API JSON follows existing TypeScript contracts; do not introduce a second casing convention inside one response. Route path segments are lowercase kebab-case, with Next dynamic parameters in brackets.

Expected errors use stable uppercase snake-case codes. Correlation IDs, error codes, field names, and persisted status values are contracts; renaming them is a behavioral change.

## Imports, exports, and comments

- Prefer the `@/*` alias for cross-feature imports and nearby relative imports within a cohesive feature.
- Export the narrowest useful contract. Do not create barrel files solely to shorten imports.
- Comments explain invariants, compatibility constraints, or non-obvious trade-offs; they do not restate syntax.
- Match the surrounding formatting. The repository has no Prettier configuration; ESLint and TypeScript are the enforceable baseline.

## Rename checklist

Before moving or renaming a symbol/file:

1. Search all consumers, tests, stories, dynamic imports, scripts, and documentation.
2. Keep structural renames separate from behavior changes when practical.
3. Preserve compatibility only when a real consumer requires it.
4. Run focused tests, typecheck, and the relevant local verification gate.
5. Review Git's rename detection and the final diff.

## Evidence

- `tsconfig.json`
- `eslint.config.mjs`
- `src/db/schema.ts`
- `src/lib/env.ts`
- `src/lib/admin-list-query.ts`
- `src/domain/capacity.ts`
- `src/domain/admin-*-actions.ts`
- representative modules under `src/app/admin`
- tests and stories under `tests` and `src/app/admin`
