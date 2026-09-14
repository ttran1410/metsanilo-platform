---
last_updated: 2026-09-10
document_type: reference
---

# Testing architecture

Vitest provides the automated test suite. Tests emphasize domain behavior, API contracts, admin module boundaries, URL transport/state, and workspace decomposition.

## Configuration and commands

| Check | Command | Purpose |
|---|---|---|
| Focused test | `npx vitest run tests/order-api.test.ts` | Fast iteration on one boundary |
| Full tests | `npm test` | Unit, contract, and libSQL integration tests |
| Types | `npm run typecheck` | Strict TypeScript without emit |
| Lint | `npm run lint` | ESLint/Next checks |
| Production build | `npm run build` | Next.js webpack build |
| Storybook build | `npm run build-storybook` | [TODO] Not established as a required release check |
| Local quick gate | `npm run verify:quick` | Typecheck, lint, and full Vitest suite |
| Policy gate | `npm run verify:policy` | Instruction files, source-of-truth links, and private requirements boundary |
| Local full gate | `npm run verify` | Quick gate plus production build |
| Local release gate | `npm run verify:release -- main` | Full gate plus DB-change classification and disposable migration-chain validation |

Vitest uses the Node environment and disables file-level parallelism. Integration tests create and migrate disposable `file:` databases; they must never use a shared remote database.

## Test organization

- `tests/order-api.test.ts` covers public order persistence, idempotency, capacity, and API behavior.
- Domain tests cover transitions, availability, reviews, customers, reports, seasons, notifications, and storefront themes.
- Contract tests scan or import admin routes/actions to enforce permission and module boundaries.
- URL-state tests protect query transport for admin workspaces.
- Decomposition tests protect the shape of large admin modules.
- Storybook stories provide visual fixtures but do not prove browser flows or accessibility.

## Coverage gaps

No committed Playwright/Cypress suite, coverage threshold, accessibility automation, load test, migration rollback test, production smoke automation, or backup/restore drill is evidenced. Exact test count is recorded only after a fresh run; do not preserve counts as timeless prose.

For bugs, add a regression test at the lowest owning layer and an API/contract test when the boundary changes. For migrations, apply the full migration chain to a fresh disposable database and test data preservation separately when a migration rebuilds a table.

## Audit verification snapshot

On 2026-08-30, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` passed. Vitest reported 41 files and 228 tests. The full migration chain applied to a new disposable libSQL file and recorded 40 entries in `__drizzle_migrations`. Build completed with repeated Better Auth warnings because the local/build fallback secret is low-entropy; no production secret value was inspected.

## Evidence

- `vitest.config.ts`
- `package.json`
- `tests`
- Story files under `src/app/admin`
- Integration setup in `tests/order-api.test.ts` and related database tests
