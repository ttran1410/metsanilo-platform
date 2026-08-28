# Coding Conventions

## Naming Rules

| Item | Rule | Example | Evidence |
|---|---|---|---|
| Files | kebab-case or Next route convention | `admin-order-actions.ts` | `src/domain` |
| Functions | camelCase, verb-led | `updateAdminProfile` | `src/domain/admin-user-actions.ts` |
| Types | PascalCase | `AdminActionContext` | `src/domain/admin-action-context.ts` |
| Constants | camelCase for local constants; uppercase for fixed sets | `PAYMENT_METHODS` | `src/domain/payment-methods.ts` |

## Formatting and Linting

- Linter: ESLint 9 with Next configuration in `eslint.config.mjs`.
- TypeScript is strict through `tsconfig.json`.
- Commands: `npm run lint`, `npm run typecheck`.
- Existing lint warnings include image optimization and one hook dependency warning; there are currently no lint errors.

## Imports and Errors

- Internal imports commonly use the `@/` TypeScript alias.
- `DomainError` is thrown for stable business/API failures.
- API handlers use `failure(error)` and `success(data)` from `src/app/api/response.ts`.
- Unexpected errors are logged server-side with a correlation ID; safe generic text is returned to clients.

## Admin Action Naming

- Action names should identify actor, domain, and operation: `updateAdminProfile`, `deleteAdminOrderSource`.
- Query names should identify read scope: `getAdminProductDetail`, `listAdminMedia`.
- Do not create a generic action that hides unrelated domain transitions.

## Testing

- Tests are in `tests/` and use Vitest.
- Test behavior through action/query interfaces where possible.
- [TODO] Add browser-level Network assertions; current automated suite does not prove DevTools request visibility.

## Evidence

- `eslint.config.mjs`
- `tsconfig.json`
- `src/app/api/response.ts`
- `src/domain/errors.ts`
- `src/domain/admin-*actions.ts`
