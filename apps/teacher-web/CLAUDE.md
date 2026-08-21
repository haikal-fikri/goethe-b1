# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Part of the goethe-b1 monorepo — see the root [CLAUDE.md](../../CLAUDE.md) for workspace layout, shared packages, and monorepo-wide commands. This file covers `apps/teacher-web` specifically.

## What this is

**apps/teacher-web** is the Lehrkraft (teacher) portal for the B1+Trainer LMS — Vercel Project B, dev port 3001. Teachers manage classes, assign writing/speaking tasks, grade submissions, run the schedule/attendance, and manage their subscription. It shares the same Supabase project (Postgres DB) as `apps/web` and `apps/admin`, and shares `@repo/core`/`@repo/types`/`@repo/server` with the rest of the monorepo. UI copy is **formal Sie** (unlike the du-form mobile/web learner apps).

## Commands

```bash
npm run dev      # next dev --port 3001
npm run build    # production build — this is the correctness gate (TS typecheck; no lint script, no test runner in this repo)
npm start        # next start --port 3001
```

## Architecture

Routes under `src/app/(app)/` (authenticated shell, gated by `requireAuth` in `layout.tsx` — non-teacher/non-admin users are redirected to `/willkommen`, a standalone subscribe funnel):
- `dashboard/` — grading queue, stats, upcoming sessions
- `klassen/` (+ `[classId]/`) — class roster, invite/rotate/remove/revoke/archive, Aufgaben/Anwesenheit tabs
- `aufgaben/` (+ `[id]/`, `neu/`) — writing + speaking assignment list/detail/create
- `stundenplan/` (+ `[sessionId]/`) — recurring schedule rules, ad-hoc/cancel sessions, attendance roster
- `bewerten/schreiben/[submissionId]/` and `bewerten/sprechen/[submissionId]/` — grading UI (band selector uses `pointsFromBands`/`pointsFromSpeakingBands` from `@repo/core`); speaking review includes lazy presigned audio playback
- `abo/` — plan/usage meters, Polar-backed paywall and checkout/portal links
- `einstellungen/` — profile, AVV (DPA) consent, sign-out

Standalone routes: `login/`, `willkommen/` (non-subscriber funnel), `billing/done/` (Polar success redirect — polls `refreshSession` until the webhook-granted role lands, since the JWT is stale until re-minted), `auth/confirm/` + `auth/signout/`.

API routes under `src/app/api/`:
- `assignments/[id]/review`, `assignments/[id]/submit`, `assignments/grade` — writing assignment lifecycle
- `speaking/submit`, `speaking/finalize`, `speaking/grade`, `speaking/audio` — speaking submission lifecycle (finalize triggers Whisper transcription; audio is a grader-gated presigned-GET proxy)
- `billing/checkout`, `billing/portal`, `billing/webhook` — Polar
- `class/invite`, `class/remove-student`, `class/sessions/[id]`, `org/invite` — roster/org management
- `consent/`, `onboarding/accept-dpa/`, `exam-feedback/`
- `auth/otp` — same hardened OTP pattern as `apps/web`, Turnstile-gated
- `jobs/close-terms`, `jobs/fair-use-sweep`, `jobs/generate-sessions`, `jobs/purge-audio`, `jobs/retention-sweep`, `jobs/session-reminders` — six cron jobs, guarded by `CRON_SECRET_B`

## Auth model

`@supabase/ssr` cookie session, same pattern across all three Next apps in this monorepo. `src/lib/auth.ts`'s `requireAuth()` is a **server-component page guard only** — it redirects anonymous users but is explicitly documented (in-file, German comments) as *optimistic, not an authorization boundary*. **Every `/api` route independently re-verifies the Bearer JWT** (`requireUser` + `hasRole`) regardless of the cookie session. The client attaches that Bearer token via `authedFetch()` in `lib/api.ts` (401 → silent refresh → retry once). `proxy.ts` at the app root (Next 16's rename of `middleware.ts`) only refreshes the cookie session for page routes (matcher excludes `/api`, `/auth`, static assets) — it is explicitly *not* an authz boundary either.

Roles live in Supabase `app_metadata.role` (`roleOf()`/`isTeacher()`/`isAdmin()`), never `user_metadata`. After a role change the user must re-login — the JWT's `app_metadata` is minted at issuance.

## Data access

Two paths, by trust level:
- **Service-role API routes** (above) for privileged writes — grading, billing webhooks, invites, cron jobs.
- **Client-direct Supabase reads** via a DAL under `src/lib/data/*.ts` (`classes.ts`, `assignments.ts`, `schedule.ts`, `notifications.ts`, `org.ts`) — RLS-gated, no route hop needed. Dependency-injected on a `SupabaseClient`, not itself a route.

## Third-party integrations

- **Groq** (`@ai-sdk/groq`) — writing-grading logic shared with `apps/web` via `@repo/core`; Whisper transcription in `lib/transcribe.ts` (`groq.transcription('whisper-large-v3')`) — **must** pass `responseFormat: 'verbose_json'` or `durationInSeconds` comes back `undefined`, silently defeating the 5-minute recording guard and usage metering. Both features have kill-switches: `GRADING_ENABLED` / `TRANSCRIBE_ENABLED`.
- **Cloudflare R2** (`lib/r2.ts`, `@aws-sdk/client-s3`) — presigned PUT/GET/DELETE against the R2 S3-compatible endpoint for speaking-audio, a private bucket purged by the `jobs/purge-audio` cron on a retention schedule. Presigned PUT can't cap upload size — `finalize` rejects >20MB via a `content-length` check before buffering.
- **Polar** (`lib/polar.ts`, `@polar-sh/sdk`) — subscription billing. Webhook signature-verified (`validateEvent`) and idempotent via the `webhook-id` header; `checkouts.create` stamps `metadata.supabase_user_id` + `externalCustomerId`; the customer portal comes from `customerSessions.create({externalCustomerId})`.
- **Resend** — transactional email, shared pattern with `apps/web`.
- **Expo push** (`lib/expoPush.ts`) — server-side push to mobile students on assignment/session events (`EXPO_ACCESS_TOKEN`).
- **Speechace** — env var `SPEECHACE_API_KEY` exists but this integration is **deferred/inactive** (behind a legal gate), not yet wired to any route.

Design reference: `design/teacher-lms.dc.html` — a **design reference only**, not app code, same convention as `apps/mobile/design/`.

## Environment

See `.env.example` for the full annotated list. What it can't tell you: `DATABASE_URL` must use the session-pooler, **not** the 6543 transaction pooler (which blocks DDL); this app's Upstash rate-limit keys are namespaced `tb:*` (web uses `rl:web:*`, admin `tc:*`); `CRON_SECRET_B` guards all six `jobs/*` routes; and `SPEECHACE_API_KEY` is present but inactive (see above).
