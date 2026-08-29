# Testing Patterns

## Test Stack and Commands

- Primary framework: Vitest 4.1.10.
- Commands:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Test Layout

- Tests are stored under `tests/`.
- Test names use `.test.ts`.
- Storybook stories under `src/app/admin/ui` provide UI fixtures but are not a replacement for browser tests.

## Current Scope

| Scope | Covered | Notes |
|---|---|---|
| Unit/domain | Yes | Domain and validation behavior |
| Integration/API | Yes | Disposable local databases are used by integration tests |
| E2E/browser | [TODO] | No verified browser Network assertion found |

The latest verified run was 20 test files and 126 passing tests. Exact coverage percentage is [TODO]; no enforced coverage threshold was found in the inspected configuration.

## Query Migration Test Plan

1. Test the typed query action directly with a disposable shop-scoped database.
2. Verify equivalent filters return equivalent data before and after migration.
3. Verify permission and shop mismatch failures.
4. Verify empty and error UI states.
5. Verify one request per initial load/filter change using browser automation. [TODO] Add Playwright coverage if the project adopts it.
6. Verify Orders API response has JSON content type and `{ data, correlationId }`.

## Evidence

- `package.json`
- `vitest.config.ts`
- `tests`
- `src/app/api/response.ts`
- `AGENTS.md`
