---
last_updated: 2026-09-14
applies_to: repository runtime policy
document_type: reference
---

# Technology stack

Use this reference to identify the runtime, build tools, and dependencies that are actually present in the repository.

## Runtime and package management

| Area | Current implementation | Enforcement |
|---|---|---|
| Language | TypeScript 5.9.3 | Locked in `package-lock.json` |
| Web runtime | Next.js 16.3.0, React 19.2.8 | Runtime dependencies |
| Module format | ESM (`"type": "module"`) | `package.json` |
| Package manager | npm | `package-lock.json` |
| Node.js | 24.x | `.nvmrc`; CI reads the same file |
| Database | Turso/libSQL through Drizzle ORM 0.45.2 | `src/db/client.ts`, `drizzle.config.ts` |

## Production dependencies

| Dependency | Responsibility | Primary evidence |
|---|---|---|
| `next`, `react`, `react-dom` | App Router rendering, route handlers, and UI | `src/app` |
| `drizzle-orm`, `@libsql/client` | Schema-aware queries, transactions, and migrations | `src/db`, `scripts/migrate.ts` |
| `better-auth`, `@better-auth/drizzle-adapter` | Parallel admin authentication path | `src/lib/better-auth.ts` |
| `@vercel/blob` | Production product and page media objects behind the storage abstraction | `src/lib/media-storage.ts`, `src/domain/admin-media-actions.ts` |
| `zod` | Environment, route, form, and domain validation | `src/lib/env.ts`, route/domain schemas |
| `lucide-react` | Interface icons | Admin/storefront components |

## Development and verification tools

| Tool | Command | Notes |
|---|---|---|
| TypeScript | `npm run typecheck` | Strict, no emit |
| ESLint 9 | `npm run lint` | Next.js configuration |
| Vitest 4 | `npm test` | Node environment, file parallelism disabled |
| Next build | `npm run build` | Uses webpack intentionally |
| Drizzle Kit | `npm run db:generate` | Run only after schema changes |
| Storybook 10 | `npm run storybook`, `npm run build-storybook` | UI fixtures; not evidenced as a release gate |

## CLI tooling observed on the audited host

Vercel CLI 58.11.0 and Turso CLI 1.0.32 are installed. The repository is locally linked to Vercel project `metsanilo` through ignored `.vercel/project.json`. Turso CLI reported that it was not logged in. Vercel authentication could not be confirmed because `vercel whoami` and `vercel project ls` returned no identity/project list despite exit code 0.

Treat this host snapshot as diagnostic evidence, not a repository guarantee. Recheck CLI versions, authentication, scope, and project/database targets before any state-changing operation.

## Evidence

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `eslint.config.mjs`
- `src/db/client.ts`
- `src/lib/better-auth.ts`
- `src/domain/admin-media-actions.ts`
- `src/lib/media-storage.ts`
- CLI `--version` and auth-status output captured on 2026-08-30
