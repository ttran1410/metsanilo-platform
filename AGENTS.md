# Repository Instructions

## Project Shape

- This is a single Next.js 16 App Router application, not a monorepo.
- Public routes live under `src/app/[locale]` for `fi` and `en`; admin pages live under `src/app/admin`; API handlers live under `src/app/api`.
- Keep business rules in `src/domain`, database access in `src/db`, and shared runtime/configuration helpers in `src/lib`; route handlers should compose these modules rather than duplicate rules.
- `src/db/schema.ts` is the Drizzle schema source of truth and `drizzle/` contains applied SQL migrations. Add a new migration for schema changes; do not rewrite an applied migration.

## Runtime Boundaries

- Every database query and mutation must remain scoped to `env().SHOP_ID`; this is a single-shop deployment with shop isolation still treated as a security boundary.
- Admin UI checks use `adminContext`/`hasAdminPermission`, and admin API handlers must call `requirePermission`; the proxy is only an early session gate, not the authorization boundary.
- Authentication currently has both Better Auth and the signed legacy `metsanilo_session` path. Preserve both paths unless the migration is explicitly being completed.
- Use integer cents for money and integer millilitres for volume. Public ordering is transactional, idempotent, and capacity-sensitive; use the existing order domain functions and version checks.
- Use `DomainError` and `src/app/api/response.ts` for API failures so callers receive stable error codes, field errors, and a correlation ID.
- Public localization is explicit through `[locale]`; use `src/lib/i18n` and locale-aware formatters instead of adding ad-hoc language branching or changing persisted status codes.

## Commands

- Install with `npm ci` for a clean checkout; use `npm run dev` for the local Next server.
- Verification commands are `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` (`build` intentionally uses `next build --webpack`).
- Run one focused test with `npx vitest run tests/order-api.test.ts` or add `-t "test name"`; Vitest runs with the Node environment and disables file parallelism.
- Integration tests create and migrate disposable `file:` libSQL databases themselves; do not point tests at a shared production/Turso database.
- For local database setup, configure `.env.local` from `.env.example`, then run `npm run db:generate` only after schema changes, followed by `npm run db:migrate` and `npm run db:seed`.
- `npm run db:preflight` validates runtime environment only. Production/release checks require a remote Turso URL, `TURSO_AUTH_TOKEN`, and a 32-character `ADMIN_SESSION_SECRET`.
- `npm run db:release` is operator-only and runs production preflight, migration, seed, then verifies the configured active Admin.
- `npm run db:seed` requires the `SEED_*`, shop/pickup, and bootstrap-admin variables in `.env.example`; it refuses an existing shop unless `SEED_ALLOW_EXISTING=true`.
- Turso CLI and Vercel CLI are available for requested database/deployment operations; use the repository scripts and configured environment variables rather than bypassing migration or release checks.

## Change Safety

- **Mandatory pre-edit gate:** before inspecting implementation files or making any edits, check the worktree with `git status --short --branch`, run `git checkout main`, run `git pull --ff-only`, create a new branch, and verify that the new branch is active.
- Do not edit files while on `main`.
- If existing changes prevent checkout, pulling, or branch creation, stop and ask the user before stashing, moving, or modifying anything.
- Use `feature/` or `feat/` for features, `bugfix/` or `fix/` for bugs, `hotfix/` for urgent fixes, `release/` for release preparation, and `chore/` for non-code work; use a short descriptive suffix such as `feature/add-login-page`.
- Do not commit `.env*`, local `*.db` files, `.next`, or generated build output; these are ignored except for `.env.example`.
- Preserve order, availability, payment, customer, and audit invariants by changing the domain transaction rather than directly updating tables from a page or route.
- When changing a persisted business behavior, update the relevant migration, domain tests, and decision/requirements record if the approved scope changes.
- `README.md`, `DESIGN.md`, and `requirements/decisions/0005-v001-single-shop-pilot-scope.md` contain product/design context; executable scripts and current domain code take precedence when older roadmap prose disagrees.
