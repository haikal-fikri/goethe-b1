# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Read `AGENTS.md` first.** This is Next.js 16 — APIs and conventions differ from older versions. Consult `node_modules/next/dist/docs/` before writing framework code.

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
- `/api/exam/grade` — Groq-backed grading; `/api/admin/simulations` — exam creation

Exam grading ([src/lib](src/lib)) evaluates writing against the four official Goethe criteria (Erfüllung, Kohärenz, Wortschatz, Strukturen) with A–E bands and a 60% pass threshold; the LLM prompt and scoring scale live in `examPrompt.ts` / `examScoring.ts`.

Exercise logic: [src/lib/exercise.ts](src/lib/exercise.ts) (shuffle/build word-bank tiles, answer check) and [src/lib/cloze.ts](src/lib/cloze.ts) (parse `{{…}}` templates, build draggable pills). Drag-and-drop uses dnd-kit; UI components live under [src/components](src/components) grouped by feature (`uebung`, `nachschlagen`, `schreiben`, `home`, `admin`).

Admin auth ([src/lib/adminAuth.ts](src/lib/adminAuth.ts)) is a stateless HMAC-signed session cookie (no user table); requires `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET`.

## Environment

`.env` provides `DATABASE_URL` (Postgres), `GROQ_API_KEY` (exam grading), `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`. Confirm whether `DATABASE_URL` targets a dev or production DB before running migrations/UPDATEs against it.
