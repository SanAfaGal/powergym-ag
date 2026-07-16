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

pnpm test:e2e          # playwright test (auto-starts `pnpm dev` if not already running)
```

Single pgTAP file: `supabase test db supabase/tests/database/012_catalog_...test.sql` (or use `supabase test db` filters).
Single Playwright spec: `pnpm test:e2e tests/e2e/plans.spec.ts`.

## Architecture

Next.js App Router + Supabase (Postgres, auth, RLS). Business logic lives in `src/modules/*`, not in `src/app/**` — pages are thin and just call module queries/actions and render module components.

### Module pattern (`src/modules/*`)

Modules: `auth`, `bank-accounts`, `clients`, `dashboard`, `plans`, `staff`, `subscriptions`. Each follows the same shape:

- `schema.ts` — zod schemas + inferred `*Input` types, shared by client-side `zodResolver` forms and server-side validation
- `queries.ts` — read-only Supabase calls (server-only, uses `@/lib/supabase/server`)
- `actions.ts` — `"use server"` mutations
- `components/` — module-scoped UI, often three responsive variants (`*Table` / `*List` / `*Cards`)
- `index.ts` — barrel exporting the above for consumption by `app/` pages

Exceptions: `dashboard` is read-only (no `actions.ts`/`schema.ts`); `auth` has no `queries.ts` (login only).

### Server actions

Mutations call **Postgres RPCs** (`create_subscription`, `record_payment`, `cancel_subscription`, ...) rather than raw table inserts — business rules and guards live in SQL functions, not in TS. Actions:

1. `schema.safeParse(values)` first (belt-and-suspenders alongside the form's client-side validation)
2. call the RPC via the server Supabase client
3. map specific, exact-match known Postgres error strings to user-facing Spanish messages, falling back to a generic message for anything unrecognized (never leak raw Postgres errors to the UI)
4. return a discriminated union `{ error: string } | { success: true }` — no thrown exceptions
5. `revalidatePath(...)` on success

UI copy and toasts (sonner) are in Spanish — match this when adding user-facing strings.

### Supabase clients (`src/lib/supabase/`)

- `client.ts` — browser client, Client Components only
- `server.ts` — server client via `next/headers` cookies; swallows `setAll` failures in Server Components (middleware refreshes the session, so this is safe)
- `middleware.ts` — `updateSession(request)`, used by `src/proxy.ts`; uses `getUser()` (not `getSession()`) to revalidate against Supabase rather than trusting the cookie

### Auth gating (defense in depth, two layers)

1. `src/proxy.ts`: no user → redirect `/login`; `profiles.is_active === false` → force `signOut()` and redirect to `/login?error=inactive` (must manually copy cookies from `supabaseResponse` onto the redirect response); logged-in user hitting `/login` → redirect `/dashboard`.
2. `src/app/(dashboard)/layout.tsx`: re-checks `supabase.auth.getUser()` server-side (should be unreachable, but kept as a second gate), then fetches `profiles.full_name/role` to drive `AppSidebar` nav (admin vs employee).

### Database (`supabase/`)

- `migrations/` — sequential, zero-padded (`00000000000NNN_description.sql`), one logical change per file (enums, per-domain tables, RLS policies, RPCs, cron jobs, bugfixes)
- `seed.sql` — local-only seed data; `auth.users` rows have documented GoTrue quirks, read the inline comments before editing
- `schema.dbml` — hand-maintained snapshot, **not** auto-generated — update it by hand whenever migrations change the schema
- `tests/database/` — pgTAP tests, numbered to roughly match migrations, plus `000_test_helpers.sql` (defines `tests.create_supabase_user(...)`, `tests.authenticate_as(...)` which does `set local role authenticated`). Every assertion needs an explicit description string (required by the installed pgtap version). Tests wrap in `begin/rollback`.

### UI component layers

- `src/components/ui/` — shadcn primitives, no business logic
- `src/components/shared/` — small cross-module composites built on `ui/` (e.g. `MoneyInput`, `StatusBadge`, `SegmentedFilter`)
- `src/components/layout/` — app chrome (`AppSidebar`, `PageHeader`)

### Conventions

- Single path alias: `@/*` → `./src/*`
- `src/lib/validations/` is unused (empty) — validation lives per-module in `schema.ts`, not centrally
- Forms: `react-hook-form` + `@hookform/resolvers/zod`, submit handler calls the server action and surfaces `{ error }` back onto the form/toast
