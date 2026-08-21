# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Part of the goethe-b1 monorepo — see the root [CLAUDE.md](../../CLAUDE.md) for workspace layout, shared packages, and monorepo-wide commands. This file covers `apps/admin` specifically.

## What this is

**apps/admin** is the superadmin console for internal ops — Vercel Project C, dev port 3002. It shares the Supabase project/DB with `apps/web` and `apps/teacher-web`, and `@repo/core`/`@repo/types`/`@repo/server`.

**Current state: the console is built.** Eight screens under `src/app/(app)/` (Übersicht, Organisationen, Abrechnung, Prüfungs-Korpus, KI-Bewertung, DSGVO, Analytics, Support) on the design system ported from `apps/teacher-web`, plus a working corpus editor and role-grant UI.

A house rule runs through the screens: **no number is invented.** Where the design comp shows figures with no table behind them (MRR/ARR/invoices, uptime, AI-confidence, ticket SLAs), the screen renders a `NotAvailable` card naming the missing source instead. A failed read shows "—", never 0.

**This app replaced `apps/web`'s legacy password-gated `/admin` panel**, which has been deleted (teacher-lms/05 §5.1). Content editing now goes through `/api/admin/corpus/[resource]` here: Supabase JWT with `role='admin'`, zod per resource, and an `audit_log` row written in the same transaction as the mutation — so a content change can never commit unattributed.

That deletion also completed the §4.3 fix: `exam_simulations.id` is allocated under `pg_advisory_xact_lock`, which only serializes writers that take the lock. While the unlocked legacy writer still existed, the race stayed open across the two apps; this route is now the only writer. **If a second writer is ever added, it must take the same lock.**

## Commands

```bash
npm run dev      # next dev --port 3002
npm run build    # production build — this is the correctness gate (TS typecheck; no lint script, no test runner in this repo)
npm start        # next start --port 3002
```

## Architecture

`src/app/`:
- `page.tsx` — placeholder home
- `login/page.tsx`, `auth/confirm/route.ts`, `auth/signout/route.ts` — auth flow
- `api/auth/otp/route.ts` — same hardened OTP pattern as the other two Next apps
- `api/admin/grant-role/route.ts` — **fully implemented**: admin-only, rate-limited (5/day), zod-validated body, uses the service-role `supabase.auth.admin.updateUserById` to set `app_metadata.role`, writes an audit-log entry via `lib/audit.ts`
- `api/admin/corpus/[resource]/route.ts` — **fully implemented**: seven resources (skills, tasks, functions, redemittel, redemittel-translation, exam-simulations, exam-tasks) with POST/PATCH; DELETE only where it is safe (translations, and redemittel example child rows — canonical rows refuse with 409 because learner history hangs off their stable id). Writes go through postgres.js (`DATABASE_URL`, bypasses RLS); values only in `${}` slots, column lists via the `sql()` helper built from literal maps.

`src/lib/data/oversight.ts` is an `is_admin`-gated read DAL, client-direct against RLS; the per-screen `src/lib/{uebersicht,organisationen,dsgvo,abrechnung,korpus,analytics}.ts` build on it with flat queries + JS joins (never nested embeds — RLS silently drops embedded rows).

⚠️ **A missing RLS policy is invisible to the client**: PostgREST answers a denied read with HTTP 200 and count 0, not an error. Adding a table to `OVERSIGHT_TABLES` therefore requires a matching case in `apps/web/supabase/tests/rls_matrix.sql`, or the dashboard will quietly show zeros.

`scripts/e2e-corpus.ts` exercises the write path against a throwaway Postgres (24 checks: the advisory lock under concurrency, audit commit/rollback, the invariants). Run instructions are in the file header — there is no test runner in this repo.

## Auth model

Identical pattern to `apps/teacher-web`: `@supabase/ssr` cookie session for page-gating only (`requireAuth`/`requireAdmin` in `lib/auth.ts`, explicitly documented as optimistic, not an authz boundary); `proxy.ts` at the app root only refreshes that cookie session (matcher excludes `/api`/`/auth`/static); **every `/api/admin` route independently re-verifies the Bearer JWT + `role=admin`**. Role lives in `app_metadata.role`, never `user_metadata`.

## Environment

Deliberately narrow — per its own `.env.example` header comment: *"Holds NO billing (Polar) / R2 / Expo secret — that isolation is the point."* Vars: `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (RLS-bypass for corpus/role writes), `DATABASE_URL` (advisory-lock for `exam_simulations` id allocation), `UPSTASH_REDIS_REST_URL`/`_TOKEN` (rate-limit key prefix `tc:*`), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`.
