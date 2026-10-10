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
npm run build              # next build — ~16s cold, ~6s warm. Just run it.
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

**`lint` and `test` both pass while `build` still fails** when an API route
imports a module that pulls in React hooks. A single `import { useState } from
'react'` anywhere in a route's module graph makes it a client component and
`next build` rejects it — `tsc` and Jest are both happy, because neither
resolves the server/client boundary. Keep `lib/` modules imported by routes
free of React; hooks live in `hooks/`. This has already broken the build once
(`lib/validation.ts` → `app/api/auth/signup/route.ts`), so check it after any
new import from a route.

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

Recording writes (harvests, journal entries, task create/edit/delete/recurrence)
live in `lib/db/recordings.ts` and `lib/db/tasks.ts` (`updateTask`); every
statement proves plan ownership through the plan/site join. Completing a task
whose `recurring_pattern` is one of the known intervals creates the next
occurrence in the same transaction.

### Crop data source of truth

`lib/data/crops.ts` is authoritative for crop data; the `crops` table in the
database is deliberately unused — nothing reads it, so don't write a reader for
it without revisiting this decision. The file header carries the editing
contract, and `__tests__/crops-data.test.ts` enforces it (unique ids, resolvable
companion/antagonist references, populated shade band).

### Domain logic

`lib/algorithms/` (layout, materials, rotation, companion planting),
`lib/calculations/`, `lib/simulation/`, `lib/data/` (crop + plant databases),
`lib/climate/`. Specs in `docs/algorithms.md`. These are pure functions — keep them
free of React and DB imports so they stay unit-testable.

### Estimation lives beside the facts engine

`lib/garden/plan-estimate.ts` computes water, yield, value, return, per-bed
spacing fit, and sun fit from the plants a user actually saved.
`lib/garden/design-facts.ts` imports it, so every facts panel reports these
numbers.

Two data sources drive it, both live:

- `lib/data/plant-yield-data.ts` — USDA / university-extension figures for 30
  plants: yield with a min/max band, market price, gallons per week.
- `lib/data/plant-library.ts` — all 50 plants: spacing, sun, water, soil, zone.

**Rule the panels follow: report what was recorded, derive what can be derived,
and say "not recorded" for the rest.** A plan with no plants says estimation is
not possible rather than reporting a score of zero, and a bed with no recorded
size says so instead of assuming one. `__tests__/design-facts.test.ts` asserts
no `sq ft` figure appears when no area was saved — keep that assertion true when
extending the estimator.

Two data facts worth knowing before touching the sun-fit check: the library
classifies 43 plants `full` and 8 `partial`, and **no plant uses the `shade`
band** — it is currently dead data. Reclassifying plants to suit a test is
inventing horticulture; add genuinely shade-tolerant plants instead.

### Dead code

A 2026-10 sweep removed every module that had no importer — the table that used
to list them here is empty. The live modules they were easy to confuse with:
`lib/data/plant-library.ts` (15+ importers), `lib/garden/garden-tools.ts` (12),
`lib/garden/design-facts.ts` (13), `lib/canvas-elements.ts` (8),
`lib/algorithms/layout-generator.ts`, `materials-calculator.ts` and
`crop-rotation.ts` (all via `app/api/plans`), `lib/simulation/growth-engine.ts`
(1).

Removed and do not resurrect: `lib/analysis/` (design-critique,
sun-shade-calculator), `lib/calculations/` (garden-calculations),
`lib/data/plant-database.ts` + `components/plant-library.tsx` (a dead third
plant list), `lib/planning/`, `lib/permaculture/`,
`lib/simulation/growth-engine-enhanced.ts`, `lib/permaculture-elements.ts`,
`lib/config/garden-shapes.ts`, `lib/zone-management.ts`. Where a capability was
worth keeping it was rebuilt in `lib/garden/plan-estimate.ts` and
`lib/garden/design-facts.ts` — see *Estimation lives beside the facts engine*.
The NOAA solar-position calculator was deliberately *not* rebuilt: it needed a
geolocated observer to mean anything; the live sun-fit check compares recorded
site hours against each plant's requirement band instead.

**Before deleting or fixing, run the one command:**
`grep -rn "@/lib/<module>" --include=*.ts --include=*.tsx app lib components hooks e2e`
A grep hit on a module *name* is not a caller — `ZoneManagementPanel` did not
use `lib/zone-management.ts`.

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
- E2E: `e2e/**` (Playwright, `testDir: './e2e'`). `e2e/fixtures.ts` exports a
  `pageWithStorage` fixture for localStorage-backed flows. Playwright needs a dev
  server; `webServer.reuseExistingServer` means it will start one if needed.
- There is no `tests/` directory. Jest ignores `/tests/` and Playwright's testDir is
  `./e2e`, so tests placed there run in neither suite.

New domain logic needs a unit test. Bug fixes need a test that fails without the fix.

## Conventions to respect

- **Don't commit secrets.** `.env*` and `.env*.local` are gitignored. Read
  `.env.local.example` / `.env.example` for the shape.
- **Don't commit build output.** `.next/`, `*.tsbuildinfo`, `test-results/`,
  `playwright-report/` are ignored, as are `*.bak` and stray `test-results.txt`
  output. Don't add more.
- **Migrations are append-only.** Never edit an applied file in `db/migrations/`;
  add a new numbered one.
- **`tsconfig.json` includes `**/*.ts(x)`**, so stray files in the repo get
  typechecked. A leftover scratch file will break `npm run lint`.

### Jest gotchas

- **Mocking a module a class under test imports requires a *dynamic* import of
  that class.** A static `import` at the top of the test binds the real module
  before `jest.mock` installs the factory, so the mock is never called and the
  code under test fails with its own generic error (e.g. `'Failed to load
  plan'`) rather than anything pointing at the mock. Load it in `beforeAll`
  instead — see `__tests__/postgres-adapter-roundtrip.test.ts`.
- **Route tests need `@jest-environment node`.** Next's server runtime needs
  undici's `Request`/`Response`, which jsdom does not provide. That is why
  `jest.setup.js` guards its browser polyfills behind a DOM check.
- **Top-level `await` does not compile** in this Jest config; use `beforeAll`.
- Mock the API layer (`@/lib/api/http`), not `fetch`. That keeps tests off the
  network and avoids asserting on Response plumbing.
- **Assert that the fix is load-bearing.** Temporarily revert it and confirm
  the new tests go red, then restore. A test that passes both ways proves
  nothing.
- **Testing `lib/db/gardens.ts` or `lib/db/tasks.ts` needs two extra mocks.**
  Both import `lib/db/ids`, which pulls in `uuid` — ESM-only, so it cannot be
  required under Jest's CommonJS runtime ("Must use import to load ES Module").
  Mock `@/lib/db/ids` alongside `@/lib/db/pool`. Separately, `updateGarden`
  reads `.rowCount` and `.rows` off the client result, so a mocked `PoolClient`
  must return `{ rowCount, rows }`, not a bare array. See
  `__tests__/canvas-save-batching.test.ts` for the working shape.
- **Index mocked statements by SQL content, not call position.** These helpers
  run several statements per call (plan lookup, UPDATEs, delete, inserts), so
  `mock.calls[1]` is brittle; find the call whose SQL contains a fragment.
- **The patch tool redacts secrets in its diff output.** A line like
  `process.env.OPENAI_API_KEY === 'sk-placeholder'` displays as `'***'` even
  when unchanged. Before assuming an edit changed a secret-adjacent line, diff
  the bytes (`git show HEAD:file | grep -n ...`) instead of trusting the diff.
- **Importing any `tldraw` module needs the jsdom shims now in `jest.setup.js`.**
  The navigator stub replaces the whole object, so it must keep `userAgent` —
  tldraw reads it at module scope for browser detection and throws without it.
  Also required: `CSS.supports` (absent from jsdom), `TextDecoder`, and pointer
  capture / `ResizeObserver` on `window`. `ShapeUtil`'s constructor also demands
  an `Editor` even for methods that never touch it; cast the constructor in tests
  rather than standing up an editor. See `__tests__/plant-shape-data.test.ts`.
- **Never revert with `git checkout --` while a stash is open.** It discards the
  stashed copy too, so the edits are gone rather than merely unstashed. Use
  `git stash pop`.
- **`process.env.NODE_ENV` is readonly per `@types/node`.** Tests that need to
  flip it must assign through a cast (`(process.env as Record<string, string>).NODE_ENV`).

## Before calling a fix a bug fix

**Confirm the code has a real caller.** Several modules here have zero importers
and were fixed at length before that was noticed: `lib/analysis/design-critique.ts`
matched plant ids that do not exist, but nothing imports it — the UI panel reads
`lib/garden/design-facts.ts` instead. `lib/calculations/garden-calculations.ts`
produced `NaN` from unrecognised lookup keys, also with no importer. A grep hit is
not a caller. Check that something actually invokes the symbol, and be wary of a
match on the *module name* appearing in an unrelated file's path or export name —
`ZoneManagementPanel` does not use `lib/zone-management.ts`, and the barrel
`components/tldraw/index.ts` is itself unconsumed even though the modules it
re-exports are used directly.

A fix to dead code is worse than no fix: the new tests make it look like coverage
for something no user can execute. If a module has no importer, deleting it is
usually the honest change — say so plainly rather than reporting the bug as fixed.

**One command, not a guess.** `grep -rn "@/lib/<module>" --include=*.ts --include=*.tsx app lib components hooks e2e`
answers it in one step. Do that before writing a fix, not after.

## Commit conventions

Present-tense imperative subject, scoped where useful (`garden:`, `auth:`, `db:`).
Describe the change and its motivation in the body. Reference issue numbers.
Do not rewrite published history or force-push `main`.

## Autonomous work

The maintainer has granted standing authorization: **you do not need to ask for
approval before improving this codebase, committing, or pushing.** Keep going on
your own initiative instead of stopping after each change to check in.

- **Keep working.** After a change is green, look for the next worthwhile
  improvement — a bug, a missing test, a gap in an API's ownership filtering,
  dead code, an unclear abstraction. Do the work; don't narrate a plan and wait.
- **Verify, then commit, then push.** `lint` + `test` + `build` green is the
  bar (see above). Don't commit red. One focused commit per logical change; push
  to the current branch, not a new one.
- **Don't stop early.** A finished task means the work is committed and pushed,
  not just edited. If you run out of obvious improvements, say so plainly in
  your report rather than inventing busywork.
- **Batch the `build`.** It is fast enough to run inline; only background it if
  you have other work to do meanwhile.

Authorization does not extend past the guardrails above: no secrets, no build
output, no editing applied migrations, no rewrites of history others have already
pulled, and no force-pushes to `main`. If a task would require one of those, stop
and ask.

Understood: I can improve, commit, and push this codebase continuously without
checking in first, and I should keep finding work rather than stopping after one
change.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
