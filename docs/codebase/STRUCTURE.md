---
last_updated: 2026-08-30
document_type: reference
---

# Repository structure

This map identifies current entry points and ownership boundaries. It describes a single Next.js application, not a monorepo.

## Top-level map

| Path | Ownership | Notes |
|---|---|---|
| `src/app/[locale]` | Finnish/English storefront pages and client interactions | Supported locales are `fi` and `en` |
| `src/app/admin` | Admin pages, workspaces, URL state, query/action controllers, and UI primitives | Organized by feature |
| `src/app/api` | Public, admin, auth, and health HTTP adapters | Nested `AGENTS.md` applies |
| `src/domain` | Business rules, read models, transactions, and admin action adapters | Nested `AGENTS.md` applies |
| `src/db` | Drizzle schema and cached libSQL client | Nested `AGENTS.md` applies |
| `src/lib` | Environment, auth integration, permissions, localization, formatting, and query helpers | Cross-cutting runtime code |
| `drizzle` | Ordered SQL migrations and Drizzle metadata | Applied migrations are immutable |
| `scripts` | Migration, seed, release, retention, and local setup commands | May mutate databases |
| `tests` | Vitest unit/contract/integration tests | Disposable databases where persistence is needed |
| `docs` | Tracked engineering context | Start at `docs/README.md` |
| `requirements` | Local product/ADR material | Ignored by git; unavailable in a clean clone unless policy changes |

## Runtime entry points

- `src/app/layout.tsx` and App Router routes start web rendering.
- `src/proxy.ts` handles storefront locale headers and the early admin session gate.
- `src/app/api/admin/module.ts` authenticates, authorizes, parses, and executes admin API definitions.
- `src/db/client.ts` lazily creates the Drizzle/libSQL connection.
- `scripts/migrate.ts`, `scripts/seed.ts`, `scripts/preflight.ts`, and `scripts/release.ts` are operator entry points.

## Admin feature shape

Large admin modules usually contain a `page.tsx`, a module/workspace component, feature `url-state.ts`, client query/action controllers, dialogs or drawers, and record-list/detail components. Orders, customers, products, availability, reviews, users, settings, notifications, and audit follow variants of this pattern.

Do not copy an old flat path from history or stale docs. Search the current feature directory before importing or creating a file.

## Naming

- Source files and route segments use kebab-case, except Next.js special filenames and dynamic `[param]` segments.
- React components and types use PascalCase.
- Functions and variables use camelCase; exported actions are verb-led.
- Admin domain adapters use `admin-*-actions.ts`; client controllers use `use-*-controller.ts`.
- Tests use `tests/*.test.ts`; Storybook fixtures use `*.stories.tsx`.

## Evidence

- `src/app`
- `src/domain`
- `src/db`
- `scripts`
- `tests`
- `.gitignore`
- `AGENTS.md`
