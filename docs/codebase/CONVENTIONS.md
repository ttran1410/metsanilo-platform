---
last_updated: 2026-08-30
document_type: reference
---

# Coding conventions

Use these conventions when maintaining existing behavior. Search adjacent code and tests before introducing a new pattern.

## TypeScript and imports

- TypeScript is strict and uses ESM/bundler resolution.
- Internal imports usually use the `@/*` alias mapped to `src/*`; nearby relative imports are also present.
- The repository has no Prettier configuration. Match the local file style and let ESLint/TypeScript define enforceable rules.
- Prefer narrow exported types and action inputs over untyped request bodies.

## Layer behavior

| Layer | Current pattern | Avoid |
|---|---|---|
| Route handler | Parse/auth/call/adapt with `success` and `failure` | Inline business mutations or custom error envelopes |
| Domain | Throw `DomainError`, use transactions, enforce shop scope | React/browser dependencies |
| Admin client | Feature action/query controllers and URL state | Treating UI permission flags as authorization |
| Database | Drizzle schema/query primitives | Unscoped records or rewriting migrations |

## Validation and errors

Zod schemas validate environment, public form input, and many route commands. Manual checks remain in domain functions for cross-record and business invariants. Convert Zod failures with `fromZodError` where the route follows that pattern.

Expected failures use `DomainError` with stable code, status, optional detail, and field errors. `src/app/api/response.ts` returns safe JSON and a correlation ID. Unexpected failures are logged server-side and return `INTERNAL_ERROR` without a stack trace.

## Logging

The application uses `console.info` for admin timing and `console.error` for unexpected API failures. There is no logging library, centralized redaction helper, metrics SDK, tracing SDK, or alert configuration in the repository. Do not add customer PII or secrets to existing logs.

## Comments and naming

Comments explain migration constraints, compatibility behavior, or non-obvious invariants. Avoid comments that restate syntax. Keep action names actor/domain/operation specific, such as `transitionAdminOrder`; avoid generic `handleAction` domain APIs.

## Evidence

- `tsconfig.json`
- `eslint.config.mjs`
- `src/app/api/response.ts`
- `src/app/api/admin/module.ts`
- `src/domain/errors.ts`
- Representative files under `src/app/admin/*/actions` and `src/domain/admin-*-actions.ts`
