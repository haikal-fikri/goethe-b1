# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Part of the goethe-b1 monorepo — see the root [CLAUDE.md](../../CLAUDE.md) for workspace layout, shared packages, and monorepo-wide commands. This file covers `apps/web` specifically.

## What this is

**apps/web** is the public learner-facing app (Vercel Project A, default port 3000): the Redemittel practice trainer, the `/pruefen` writing-exam simulator, the legacy content-admin panel, and — increasingly — the **trusted backend API** that `apps/mobile` calls (Supabase-JWT-authenticated `/api` routes for exam grading, profile, account management, email).

## Commands

```bash
npm run dev              # dev server (http://localhost:3000)
npm run build            # production build — this is the correctness gate (TS typecheck; no test runner, no ESLint config in this repo)
npm start                # serve production build
npm run lint:tokens      # scripts/lint-tokens.sh — a custom design-token linter, NOT ESLint (there is no "lint" script here; root `turbo run lint` currently has no workspace to run it against)

npm run seed:export      # live DB → supabase/seed.sql + seed_exam.sql (full-column idempotent upserts)
npm run seed:class-dev   # scripts/seed-class-dev.mjs — seeds a dev class/teacher/students for local Klasse-flow testing against apps/teacher-web

# Bootstrap a fresh DB (use the Session-Pooler / Direct string, NOT the 6543 transaction pooler — it blocks DDL)
psql "$DATABASE_URL" -f supabase/migrations/0001_content_schema.sql   # ...then every migration in supabase/migrations/ in order (currently up to 0034)
psql "$DATABASE_URL" -f supabase/seed.sql
psql "$DATABASE_URL" -f supabase/seed_exam.sql
```

## Content architecture (the thing to understand first)

**The Postgres DB is the single source of truth.** Learner-facing content is data, not code. Every content page reads the DB at runtime via `getAllItems()` ([src/lib/redemittel.ts](src/lib/redemittel.ts)), which queries the denormalized `redemittel_item` view. The old JSON authoring pipeline (`data/corpus/*.json`, `src/content/corpus.json`) is retired.

To edit content:
- **Now:** write a SQL migration under `supabase/migrations/` (e.g. `UPDATE redemittel SET … WHERE id = …`) and apply it to the DB. `id` is a **stable surrogate key** — never recompute it from content; editing a phrase is an in-place UPDATE.
- **Bootstrap / fresh clone:** `supabase/migrations/*` (schema, now 0001–0034 — most recent ones are the shared teacher-LMS schema used by `apps/teacher-web` / `apps/admin`, not web-only) + `supabase/seed.sql` + `supabase/seed_exam.sql` (frozen content, exported from the live DB with `npm run seed:export`).
- **Via the console:** `apps/admin` (Vercel C) hosts the content editor — `/api/admin/corpus/[resource]`, Supabase login with `role='admin'`, every mutation zod-validated and written to `audit_log` in the same transaction. The legacy password-gated `/admin` panel that used to live here is **gone** (teacher-lms/05 §5.1); its `ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET` are no longer read and can be dropped from the Vercel environment of project A.

**Hard invariant:** `tokens.join(" ") === phrase_de` (the word-bank solution key). Editing a phrase requires re-syncing `tokens` and `cloze_template` in the same row. `examples` (jsonb `{de,en}[]`) holds 1–2 contextual sentences shown in feedback. The app item shape (`RedemittelItem`) lives in `@repo/types`, re-exported via `src/types/index.ts`.

Note: `distractors` are **intentional wrong-answer foils** (deliberate misspellings, wrong case, das-for-dass) — do not "correct" them. The cloze exercise matches pills against the template's own `{{…}}` blanks, independent of `tokens`.

## App structure

Routes ([src/app](src/app)):
- `(shell)` route group — `/lernen` (searchable reference of all phrases), `/pruefen` (Goethe-B1 writing exam simulator with AI grading), `/pay` + `/pay/danke` (Stripe pay-what-you-want checkout)
- `/uebung/[lessonId]` — exercise player (word-bank + cloze, keyboard 1–9 / Enter / Backspace)

API routes ([src/app/api](src/app/api)) — the ones with non-obvious contracts:
- `/api/exam/grade` — Groq-backed writing grading; `/api/exam/email` — Resend-backed sending of a graded result to learner + teacher
- `/api/auth/otp` — Supabase-Auth OTP endpoint; this is `apps/mobile`'s **email-OTP fallback** login path (magic-link/Google/Apple are handled client-side by `supabase-js` directly)
- `/api/account/*`, `/api/profile/*` — authenticated (Bearer JWT) endpoints for the mobile app's account/profile management

Exam grading ([src/lib](src/lib)) evaluates writing against the four official Goethe criteria (Erfüllung, Kohärenz, Wortschatz, Strukturen) with A–E bands and a 60% pass threshold; the LLM prompt and scoring scale live in `examPrompt.ts` / `examScoring.ts` (these now live in `@repo/core`, shared with `apps/teacher-web`'s grading).

Exercise logic: `src/lib/exercise.ts` (shuffle/build word-bank tiles, answer check) and `src/lib/cloze.ts` (parse `{{…}}` templates, build draggable pills). Drag-and-drop uses dnd-kit; UI components live under `src/components` grouped by feature (`uebung`, `nachschlagen`, `schreiben`, `home`).

Shared workspace packages actually imported here: `@repo/core` (exercise/cloze/exam logic, content helpers), `@repo/types` (domain types), `@repo/server` (db/ratelimit/log/supabaseServer — server-only helpers shared with teacher-web/admin).

## Environment

`.env` (see `.env.example` for the full annotated list) provides, grouped by concern:
- **Site URL**: `NEXT_PUBLIC_SITE_URL` — set in Vercel prod; without it, canonical URLs silently fall back to Vercel's shortest production domain.
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` (required for mobile-app auth + authenticated `/api` paths) + `SUPABASE_SERVICE_ROLE_KEY` (server-only, never in the mobile bundle — CI bundle-audit enforces this) + `DATABASE_URL` (content DB, Postgres).
- **Grading**: `GRADING_ENABLED` (kill switch, 503 when false), `CRON_SECRET`, `GROQ_API_KEY`.
- **Abuse protection**: Turnstile (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`, set both or neither) on `/pruefen`; Upstash Redis (`UPSTASH_REDIS_REST_URL`/`_TOKEN`) for per-IP rate limiting on `/api/exam/grade` + `/api/exam/email`, keys namespaced `rl:web:*`.
- **Resend**: `RESEND_API_KEY` (+ optional `RESEND_FROM_EMAIL`/`_NAME`) — default sandbox sender only delivers to the Resend account owner; verify a domain for real delivery.
- **Stripe**: `STRIPE_SECRET_KEY` (pay-what-you-want Checkout, framed as a voluntary payment, not a donation).

Emailing a graded result (`/pruefen`) — the lazy Resend client + sender config live in `src/lib/resend.ts`, the HTML template + zod payload schema in `src/lib/email/examResultEmail.ts`, the send route in `src/app/api/exam/email/route.ts`. Grade data is **sent from the browser** (no persistence). **Security (dual-mode route):** the anonymous web path requires a Turnstile token (mirroring `/api/exam/grade`) and is rate-limited **fail-closed** per IP; the authenticated mobile self-copy path ignores client-supplied recipients and emails only the caller's own verified address.

The pay-what-you-want page (`/pay`) uses Stripe Checkout (hosted redirect, one-time USD payments) — config + lazy client in `src/lib/stripe.ts`, session creation in `src/app/api/pay/checkout/route.ts`. Amount is validated server-side against `MIN_USD`/`MAX_USD`; route is rate-limited fail-closed per IP. No webhook (nothing to fulfill).
