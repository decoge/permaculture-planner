# AGENTS.md

Guidance for coding agents working in this repository. Read this before editing code.

## What this is

Permaculture Planner — a Next.js 16 (App Router) app that generates raised-bed garden
plans. Users answer a site-assessment wizard, then design beds and plantings on an
infinite canvas, and the app saves the plan to Postgres.

## Commands

```bash
npm install --include=dev   # REQUIRED: this env has npm omit=dev set globally
npm run dev                # dev server on :3000
npm run lint               # tsc --noEmit (this IS the typecheck gate)
npm run test               # jest unit tests (__tests__/)
npm run test:e2e           # playwright (needs a running dev server)
npm run build              # next build — slow (~7+ min), run it in the background
npm run db:migrate         # apply db/migrations/*.sql (needs .env.local)
```

`npm run lint` is `tsc --noEmit`, not ESLint. There is no ESLint config in this repo.

**Install gotcha:** the environment sets `omit=dev` in npm config, so a bare
`npm install` silently skips devDependencies and produces a *confusing* tree of
`tsc` errors (missing `@types/pg`, tldraw version skew). Always use
`npm install --include=dev`. If `tsc` reports errors that look impossible given the
source, check installed versions against `package.json` before editing code.

## Verification before you claim done

Green means all three:

```bash
npm run lint   # must be silent
npm run test   # all suites pass
npm run build  # completes
```

Do not report success on `lint` + `test` alone — `build` runs type generation
against `.next/types` and has caught errors the other two miss.

## Architecture

### Persistence: adapter pattern

`lib/persistence/types.ts` defines `IPersistenceAdapter`. Two implementations:

- `local-storage-adapter.ts` — browser/demo mode
- `postgres-adapter.ts` — signed-in mode

`lib/store/garden-store.ts` is the Zustand store: single source of truth for beds,
canvas metadata, plan name, dirty/loading/error flags. It holds an
`IPersistenceAdapter` and delegates all I/O to it. Mutations (`updateBeds`)
flip `isDirty` and kick off adapter auto-save.

**Add a new backend** by implementing `IPersistenceAdapter` and injecting it with
`setPersistence`. Do not add backend-specific branching to the store.

### Database

Plain Postgres via `pg`. No Supabase, no ORM, no query builder.

- `lib/db/pool.ts` — singleton pool, `query`/`queryOne`/`withTransaction`. Every
  `query()` awaits `ensureMigrated()` first, so migrations are self-applying.
- `lib/db/migrate.ts` — advisory-lock-guarded runner over `db/migrations/*.sql`,
  tracked in a `schema_migrations` table.
- `db/migrations/001_initial.sql` — the live schema.

**Ownership is enforced in application queries, not RLS.** Every query touching
user data must filter by the session user's id. There is no database-level
backstop, so a missed `WHERE user_id = $1` is a data leak, not a bug.

### Auth

Email + password, hand-rolled (`lib/auth/`). Passwords hashed in `lib/auth/password.ts`;
session is an HMAC-signed cookie (`lib/auth/token.ts`) with a `tokenVersion` column
for mass invalidation. `proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`)
gates protected routes and applies rate limiting, response caching, and security headers.

Bump `users.token_version` to invalidate every session for a user.

### Canvas

tldraw 5. Custom shapes in `components/tldraw/shapes/`, tools in `tools/`,
`data-adapter.ts` converts `GardenBed[]` ↔ tldraw shapes. See
`components/tldraw/README.md` for the shape/tool extension recipe.

tldraw shape props are persisted, so shape prop schema changes need a migration or
saved plans break.

### API routes

`app/api/**/route.ts`. Shared helpers in `lib/api/`: `http.ts` (`api()` client +
`ApiError`), `rate-limiter.ts`, `cache.ts`, `route-error.ts`. Use `route-error.ts`
rather than ad-hoc try/catch so status codes and messages stay consistent.

### Domain logic

`lib/algorithms/` (layout, materials, rotation, companion planting),
`lib/calculations/`, `lib/simulation/`, `lib/data/` (crop + plant databases),
`lib/climate/`. Specs in `docs/algorithms.md`. These are pure functions — keep them
free of React and DB imports so they stay unit-testable.

## Conventions

- TypeScript strict, `@/*` → repo root. No default exports in lib/ modules.
- Server components by default; `'use client'` only where interactivity demands it.
- shadcn/ui primitives in `components/ui/` — use them, don't hand-roll new ones.
  Compose with `cn()` from `lib/utils/cn.ts`.
- Tailwind for styling; theme tokens live in `tailwind.config.ts` and
  `lib/design-system/`.
- Icons: `lucide-react`.
- Comments explain *why*, not *what*. Existing JSDoc blocks on exported functions
  are the norm — match that density.

## Tests

- Unit: `__tests__/*.test.ts`, Jest + jsdom. `fake-indexeddb/auto` and DOM observers
  are polyfilled in `jest.setup.js` — add new polyfills there, not in test files.
- E2E: `e2e/**` (Playwright, testDir `./e2e`). `e2e/fixtures.ts` exports a
  `pageWithStorage` fixture for localStorage-backed flows.
- `tests/` is ignored by Jest (`testPathIgnorePatterns`) and is not the Playwright
  testDir — do not put new tests there.

New domain logic needs a unit test. Bug fixes need a test that fails without the fix.

## Conventions to respect

- **Don't commit secrets.** `.env*` and `.env*.local` are gitignored. Read
  `.env.local.example` / `.env.example` for the shape.
- **Don't commit build output.** `.next/`, `*.tsbuildinfo`, `test-results/`,
  `playwright-report/` are ignored. A few stale artifacts (`test-results.txt`,
  `final-test-results.txt`, `app/demo/page-old.tsx`, `components/context-menu.tsx.bak`)
  are tracked and are cleanup candidates — don't add more.
- **Migrations are append-only.** Never edit an applied file in `db/migrations/`;
  add a new numbered one.
- **`tsconfig.json` includes `**/*.ts(x)`**, so stray files in the repo get
  typechecked. A leftover scratch file will break `npm run lint`.

## Commit conventions

Present-tense imperative subject, scoped where useful (`garden:`, `auth:`, `db:`).
Describe the change and its motivation in the body. Reference issue numbers.
Do not rewrite published history or force-push `main`.