# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Read `AGENTS.md` first.** This is Next.js 16 — APIs and conventions differ from older versions. Consult `node_modules/next/dist/docs/` before writing framework code. (Applies to the three Next.js apps below; `apps/mobile` is Expo and has its own `AGENTS.md`.)

## What this is

A Goethe-B1 **Redemittel** (functional-phrase) trainer for German writing & speaking, grown into a small suite: a learner-facing app + mobile app, plus a teacher LMS portal and a superadmin console. Core learner mechanic: given an English translation, reconstruct the correct German sentence from a word bank or fill cloze blanks. Learner-facing UI is in German, mobile-first; content spans B1–C2.

## Monorepo layout (Turborepo + npm workspaces)

Four apps, three shared packages, one Supabase Postgres project behind all of them. **Each app has its own CLAUDE.md — read it before working in that app; this file only covers what's genuinely shared.**

| App | What | Vercel project | Dev port | Details |
|---|---|---|---|---|
| [apps/web](apps/web) | Public learner app: practice picker, exercise player, `/pruefen` writing-exam simulator, and the mobile app's trusted backend API | A | 3000 | [apps/web/CLAUDE.md](apps/web/CLAUDE.md) |
| [apps/mobile](apps/mobile) | Expo / React Native learner app (iOS + Android) | — | — | [apps/mobile/CLAUDE.md](apps/mobile/CLAUDE.md) |
| [apps/teacher-web](apps/teacher-web) | Teacher LMS portal: classes, assignments, grading, schedule, subscription billing | B | 3001 | [apps/teacher-web/CLAUDE.md](apps/teacher-web/CLAUDE.md) |
| [apps/admin](apps/admin) | Superadmin console: oversight dashboards, the audited content editor, role grants | C | 3002 | [apps/admin/CLAUDE.md](apps/admin/CLAUDE.md) |

- [packages/types](packages/types) (`@repo/types`) — shared domain types.
- [packages/core](packages/core) (`@repo/core`) — shared pure-TS logic (exercise, cloze, exam scoring/prompt/schema, teacher-grading schemas, content helpers).
- [packages/server](packages/server) (`@repo/server`) — shared server-only helpers (db, ratelimit, log, supabaseServer), extracted so `apps/teacher-web` and `apps/admin` don't duplicate `apps/web`'s server plumbing.

Shared packages ship **raw TS** (no build step) — Next transpiles them via `transpilePackages`, Metro (`apps/mobile/metro.config.js`) watches the monorepo root and transpiles them directly.

**Shared Supabase project:** all four apps read/write the same Postgres DB. `apps/web` owns the Redemittel + exam content schema (edited through `apps/admin`, never client-side); `apps/teacher-web`/`apps/admin` own the newer class/assignment/billing schema (migrations from ~0016 on). Confirm whether `DATABASE_URL` targets a dev or production DB before running migrations/UPDATEs against it — there's no `supabase_migrations` tracking table; migrations are applied manually with `psql`, in numeric order.

## Commands

Run from the repo root — `npm run dev`/`build`/`start` fan out to every app via `turbo`. Scope to one app with `--workspace <name>` (`web` / `mobile` / `teacher-web` / `admin`) or `turbo --filter=<name>`.

```bash
npm run dev      # turbo run dev   — all apps in parallel
npm run build    # turbo run build — the correctness gate; no test runner exists anywhere in this monorepo
npm run lint     # turbo run lint  — currently a no-op: no workspace defines a "lint" script, despite turbo.json wiring the task
npm run seed:export   # re-export apps/web's frozen bootstrap seed from the live DB (see apps/web/CLAUDE.md)
```

There is no ESLint or Prettier configuration anywhere in this repo. `npm run build` (per-app TypeScript compilation) is the only automated correctness check — verify changes by building the app(s) you touched and, for UI changes, running them.
