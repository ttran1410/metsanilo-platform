# Codebase Structure

## Top-Level Map

| Path | Purpose | Evidence |
|---|---|---|
| `src/app/[locale]` | Public localized storefront routes and forms | `src/app/[locale]` |
| `src/app/admin` | Admin pages, workspaces, UI composition, client fetches | `src/app/admin` |
| `src/app/api` | Next route handlers for public, admin, and auth APIs | `src/app/api` |
| `src/domain` | Business/query/mutation modules | `src/domain` |
| `src/db` | Drizzle schema and database client | `src/db` |
| `drizzle` | Applied SQL migrations and metadata | `drizzle` |
| `tests` | Vitest unit/integration tests | `tests`, `vitest.config.ts` |
| `requirements` | Product, architecture, and business documentation | `requirements` |

## Entry Points

- Web runtime: Next App Router under `src/app`.
- Admin shell: `src/app/admin/route-frame.tsx` and `src/app/admin/navigation.tsx`.
- Admin API: route handlers under `src/app/api/admin`.
- Database initialization: `src/db/client.ts`.
- CLI/release scripts: `scripts/*.ts`.

## Module Boundaries

| Boundary | Owns | Must not own |
|---|---|---|
| Page/server route | session gate, permission flags, page composition | duplicated business mutation rules |
| API route | request parsing, route permission declaration, response adapter | raw domain transactions |
| Admin action/query module | typed actor/shop context, workflow orchestration | React state or JSX |
| Domain module | business invariants and persistence behavior | browser-only behavior |
| UI workspace | query/selection state and presentation | trusted authorization decisions |

## Naming

- Files use kebab-case, with route segments following Next conventions.
- React components/types use PascalCase.
- Functions and variables use camelCase.
- Admin action modules use `admin-*-actions.ts`; planned query modules should use `admin-*-queries.ts` or an explicitly documented combined module.

## Evidence

- `src/app/admin`
- `src/app/api/admin`
- `src/domain`
- `src/db`
- `AGENTS.md`
