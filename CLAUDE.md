# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Read `AGENTS.md` first.** This is Next.js 16 — APIs and conventions differ from older versions. Consult `node_modules/next/dist/docs/` before writing framework code.

## Monorepo layout (Turborepo + npm workspaces)

This repo is a **Turborepo monorepo**. The Next.js web app lives in [apps/web](apps/web) — **every web path referenced below (`src/…`, `supabase/…`, `scripts/…`) is now relative to `apps/web/`.** Layout:

- [apps/web](apps/web) — the Next.js 16 web app (deployed on Vercel; its **Root Directory** in the Vercel project is set to `apps/web`).
- [apps/mobile](apps/mobile) — Expo / React Native app (shares domain logic via the packages below).
- [packages/types](packages/types) (`@repo/types`) — shared domain types; the canonical source for what was `src/types`. `apps/web/src/types/index.ts` is a thin re-export shim so `@/types` still works.
- [packages/core](packages/core) (`@repo/core`) — shared pure-TS logic (exercise, cloze, exam scoring/prompt/schema, content). Web imports these as `@repo/core` (was `@/lib/<name>`). Web-only libs (`db`, `redemittel`, `exam`, `adminAuth`, `stripe`, `site`, `ui`) stay in `apps/web/src/lib`.

Run scripts from the repo root (`npm run dev`/`build` fan out via `turbo`), or scope to one app with `--workspace web` / `--filter=web`. Shared packages ship **raw TS** (no build step) — Next transpiles them via `transpilePackages`, Metro via `apps/mobile/metro.config.js`.

## What this is

A Goethe-B1 **Redemittel** (functional-phrase) trainer for German writing & speaking. Core mechanic: given an English translation, the learner reconstructs the correct German sentence from a word bank or fills cloze blanks. UI is in German, mobile-first. Content spans B1–C2.

Stack: **Next.js 16 (App Router, TS) · React 19 · Tailwind v4 · Postgres (Supabase) · Groq LLM (exam grading) · Vercel**.

## Commands

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # production build (also the typecheck gate)
npm start            # serve production build

# Re-export the frozen bootstrap seed FROM the canonical DB (after editing content)
npm run seed:export  # live DB → supabase/seed.sql + seed_exam.sql (full-column idempotent upserts)

# Bootstrap a fresh DB (use the Session-Pooler / Direct string, NOT the 6543 transaction pooler — it blocks DDL)
psql "$DATABASE_URL" -f supabase/migrations/0001_content_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/0004_corrections_and_examples.sql
psql "$DATABASE_URL" -f supabase/seed.sql
psql "$DATABASE_URL" -f supabase/seed_exam.sql
```

There is no test runner configured. `npm run build` is the correctness gate (TypeScript).

## Content architecture (the thing to understand first)

**The Postgres DB is the single source of truth.** Learner-facing content is data, not code. Every content page reads the DB at runtime via `getAllItems()` ([src/lib/redemittel.ts](src/lib/redemittel.ts)), which queries the denormalized `redemittel_item` view. The old JSON authoring pipeline (`data/corpus/*.json`, `src/content/corpus.json`, the corpus/seed generators) has been **retired**.

To edit content:
- **Now:** write a SQL migration under `supabase/migrations/` (e.g. `UPDATE redemittel SET … WHERE id = …`) and apply it to the DB. `id` is a **stable surrogate key** — never recompute it from content; editing a phrase is an in-place UPDATE.
- **Bootstrap / fresh clone:** `supabase/migrations/*` (schema) + `supabase/seed.sql` + `supabase/seed_exam.sql` (frozen content). The seed is **exported from the live DB** with `npm run seed:export` ([scripts/export-seed.mjs](scripts/export-seed.mjs)) — re-run it after content edits so a clone reproduces them. Its upserts update **all** columns on conflict.
- **Later:** an admin UI for editing Redemittel (the password-gated panel already edits exam simulations and writes straight to the DB).

**Hard invariant:** `tokens.join(" ") === phrase_de` (the word-bank solution key). Editing a phrase requires re-syncing `tokens` and `cloze_template` in the same row. `examples` (jsonb `{de,en}[]`, migration 0004) holds 1–2 contextual sentences shown in feedback. The app item shape (`RedemittelItem`) is in [src/types/index.ts](src/types/index.ts).

Note: `distractors` are **intentional wrong-answer foils** (deliberate misspellings, wrong case, das-for-dass) — do not "correct" them. The cloze exercise matches pills against the template's own `{{…}}` blanks, independent of `tokens`.

## App structure

Routes ([src/app](src/app)):
- `/` — practice picker (skill tabs, level filter, function cards)
- `/uebung/[lessonId]` — exercise player (word-bank + cloze, keyboard 1–9 / Enter / Backspace)
- `/lernen` — searchable reference of all phrases
- `/pruefen` — Goethe-B1 writing exam simulator with AI grading
- `/admin` + `/admin/login` — password-gated panel to create exam simulations (writes exam content **directly to the DB**, bypassing the JSON pipeline — a second writer to be aware of)
- `/api/exam/grade` — Groq-backed grading; `/api/admin/simulations` — exam creation; `/api/exam/email` — Resend-backed sending of a graded result to the learner + teacher

Exam grading ([src/lib](src/lib)) evaluates writing against the four official Goethe criteria (Erfüllung, Kohärenz, Wortschatz, Strukturen) with A–E bands and a 60% pass threshold; the LLM prompt and scoring scale live in `examPrompt.ts` / `examScoring.ts`.

Exercise logic: [src/lib/exercise.ts](src/lib/exercise.ts) (shuffle/build word-bank tiles, answer check) and [src/lib/cloze.ts](src/lib/cloze.ts) (parse `{{…}}` templates, build draggable pills). Drag-and-drop uses dnd-kit; UI components live under [src/components](src/components) grouped by feature (`uebung`, `nachschlagen`, `schreiben`, `home`, `admin`).

Admin auth ([src/lib/adminAuth.ts](src/lib/adminAuth.ts)) is a stateless HMAC-signed session cookie (no user table); requires `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET`.

## Environment

`.env` provides `DATABASE_URL` (Postgres), `GROQ_API_KEY` (exam grading), `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `STRIPE_SECRET_KEY` (pay-what-you-want Checkout, `/pay`), `RESEND_API_KEY` (emailing graded results, `/pruefen` → `/api/exam/email`). Confirm whether `DATABASE_URL` targets a dev or production DB before running migrations/UPDATEs against it.

Emailing a graded result (`/pruefen`) uses **Resend** — the lazy client + sender config live in [src/lib/resend.ts](src/lib/resend.ts), the HTML template + zod payload schema in [src/lib/email/examResultEmail.ts](src/lib/email/examResultEmail.ts), and the send route in [src/app/api/exam/email/route.ts](src/app/api/exam/email/route.ts). The grade data is **sent from the browser** (no persistence). **Security (route is dual-mode):** the anonymous web path requires a **Turnstile** token (verified server-side, mirroring `/api/exam/grade`) and is rate-limited **fail-closed** per IP — this prevents the branded sender from being abused as an open email relay once a real domain is configured; the authenticated mobile self-copy path ignores client recipients and emails only the caller's own verified address. `RESEND_FROM_EMAIL` (default `onboarding@resend.dev`) and `RESEND_FROM_NAME` (default `B1+Trainer`) are optional; the default sandbox sender **only delivers to the Resend account owner's address** — verify a domain in Resend and set `RESEND_FROM_EMAIL` for real delivery to a teacher (and ensure `TURNSTILE_SECRET_KEY` + Upstash are set in prod so the anon guards don't no-op).

The pay-what-you-want page (`/pay`) uses **Stripe Checkout** (hosted redirect, one-time USD payments — framed as a voluntary payment for using B1+Trainer, **not** a charitable donation) — config constants and the lazy client live in [src/lib/stripe.ts](src/lib/stripe.ts), the session is created in [src/app/api/pay/checkout/route.ts](src/app/api/pay/checkout/route.ts). The amount is validated server-side against `MIN_USD`/`MAX_USD` and the route is rate-limited **fail-closed** per IP (`payCheckout` limiter). No webhook (nothing to fulfill). Use a `sk_test_…` key + card `4242 4242 4242 4242` to test before going live.
