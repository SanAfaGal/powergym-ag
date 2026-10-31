# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
pnpm dev             # Next.js dev server
pnpm build            # production build
pnpm lint             # eslint (flat config)

pnpm db:start          # start local Supabase (docker)
pnpm db:stop           # stop local Supabase
pnpm db:reset          # re-run migrations + seed.sql against local DB
pnpm db:test           # run pgTAP tests in supabase/tests/database via `supabase test db`

pnpm test:unit         # node --test on access-control + src/lib pure helpers
pnpm models:fetch      # download vision models into public/models (auto in predev/prebuild)
pnpm test:e2e          # playwright test (auto-starts `pnpm dev` if not already running)
```

Single pgTAP file: `supabase test db supabase/tests/database/012_catalog_...test.sql` (or use `supabase test db` filters).
Single Playwright spec: `pnpm test:e2e tests/e2e/plans.spec.ts`.

## Architecture

Next.js App Router + Supabase (Postgres, auth, RLS). Business logic lives in `src/modules/*`, not in `src/app/**` — pages are thin and just call module queries/actions and render module components.

### Module pattern (`src/modules/*`)

Modules: `access-control`, `auth`, `bank-accounts`, `clients`, `dashboard`, `plans`, `staff`, `subscriptions`. Each follows the same shape:

- `schema.ts` — zod schemas + inferred `*Input` types, shared by client-side `zodResolver` forms and server-side validation
- `queries.ts` — read-only Supabase calls (server-only, uses `@/lib/supabase/server`)
- `actions.ts` — `"use server"` mutations
- `components/` — module-scoped UI, often three responsive variants (`*Table` / `*List` / `*Cards`)
- `index.ts` — barrel exporting the above for consumption by `app/` pages

Exceptions: `dashboard` is read-only (no `actions.ts`/`schema.ts`); `auth` has no `queries.ts` (login only); `access-control` (facial access prototype, see `docs/access-control/README.md`) keeps browser-only camera/vision code under `lib/vision/` and compares faces inside a Postgres RPC (`register_access_attempt`), never in TS. Its pure helpers are tested with `pnpm test:unit` and import each other with explicit `.ts` extensions so `node --test` can run them.

### Server actions

Mutations call **Postgres RPCs** (`create_subscription`, `record_payment`, `cancel_subscription`, ...) rather than raw table inserts — business rules and guards live in SQL functions, not in TS. Actions:

1. `schema.safeParse(values)` first (belt-and-suspenders alongside the form's client-side validation)
2. call the RPC via the server Supabase client
3. map specific, exact-match known Postgres error strings to user-facing Spanish messages, falling back to a generic message for anything unrecognized (never leak raw Postgres errors to the UI)
4. return a discriminated union `{ error: string } | { success: true }` — no thrown exceptions
5. `revalidatePath(...)` on success

UI copy and toasts (sonner) are in Spanish — match this when adding user-facing strings.

### Supabase clients (`src/lib/supabase/`)

- No browser client: all Supabase access goes through the server client (server actions / Server Components). Add a `client.ts` only if a Client Component truly needs direct access.
- `server.ts` — server client via `next/headers` cookies; swallows `setAll` failures in Server Components (middleware refreshes the session, so this is safe)
- `middleware.ts` — `updateSession(request)`, used by `src/proxy.ts`; uses `getClaims()` (not `getSession()`), which verifies the JWT instead of trusting the cookie

### Auth gating (defense in depth, two layers)

1. `src/proxy.ts`: no user → redirect `/login`; `profiles.is_active === false` → force `signOut()` and redirect to `/login?error=inactive` (must manually copy cookies from `supabaseResponse` onto the redirect response); logged-in user hitting `/login` → redirect `/dashboard`.
2. `src/app/(dashboard)/layout.tsx`: calls `getAuthContext()` (`src/lib/auth/session.ts`), which trusts the profile `src/proxy.ts` forwards in the `x-staff-profile` header (falling back to its own `getClaims()` + profile query), as a second gate, and uses the profile to drive `AppSidebar` nav (admin vs employee).

### Database (`supabase/`)

- `migrations/` — sequential, zero-padded (`00000000000NNN_description.sql`), one logical change per file (enums, per-domain tables, RLS policies, RPCs, cron jobs, bugfixes)
- `seed.sql` — local-only seed data; `auth.users` rows have documented GoTrue quirks, read the inline comments before editing
- `audit_log` (migration 0053) records every change to payments, subscriptions, plan prices, bank accounts and profiles via the `audit_row_change()` trigger; add the trigger to any new money/access table
- `schema.dbml` — hand-maintained snapshot, **not** auto-generated — update it by hand whenever migrations change the schema
- `tests/database/` — pgTAP tests, numbered to roughly match migrations, plus `000_test_helpers.sql` (defines `tests.create_supabase_user(...)`, `tests.authenticate_as(...)` which does `set local role authenticated`). Every assertion needs an explicit description string (required by the installed pgtap version). Tests wrap in `begin/rollback`.

### UI component layers

- `src/components/ui/` — shadcn primitives, no business logic
- `src/components/shared/` — small cross-module composites built on `ui/` (e.g. `MoneyInput`, `StatusBadge`, `SegmentedFilter`)
- `src/components/layout/` — app chrome (`AppSidebar`, `PageHeader`)

### Conventions

- Single path alias: `@/*` → `./src/*`
- Validation lives per-module in `schema.ts`, not centrally
- Module `index.ts` barrels export only what `app/` pages import; components inside a module import each other by relative path
- Forms: `react-hook-form` + `@hookform/resolvers/zod`, submit handler calls the server action and surfaces `{ error }` back onto the form/toast
