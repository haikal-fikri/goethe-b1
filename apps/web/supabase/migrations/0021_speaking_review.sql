-- ============================================================
--  0021 — Speaking review (transcription-first, D7) + 72h/24h retention.
--  record → transcribe (Groq Whisper) → AI content-grade (4 criteria) → teacher
--  accept/edit/remark + Aussprache manual → release. Speechace deferred (no schema
--  change: speaking_submissions.speechace jsonb exists). Canonical: teacher-lms/02 §6.
--  Depends on: 0009 (speaking_submissions/speaking_submission_owner), 0007 (app_global_rate_limits),
--              0016 (is_class_locked), 0008 (has_active_teacher_sub/is_class_teacher).
-- ============================================================

set check_function_bodies = off;

-- ── 6.1 Transcription-first flow + 72h retention on the existing 0009 table ─
alter table speaking_submissions
  add column if not exists transcribed_at timestamptz;
-- Retune the purge backstop from 7 days (0009) to 72 hours (no rows in prod yet).
alter table speaking_submissions alter column audio_purge_at set default (now() + interval '72 hours');
comment on column speaking_submissions.audio_purge_at is
  'Backstop now()+72h (ungraded). Grade route resets to graded_at+24h. Purge cron nulls audio_key + deletes R2 object; transcript survives.';
-- Status flow (speaking_status 0009: recorded|scored|graded|purged|failed):
--   submit → 'recorded'; finalize transcribes + AI-recommends → 'scored';
--   teacher grade → 'graded'; purge → keeps status, audio_key=null.

-- Term-lock new speaking assignments (D13, §1.6) — grade routes stay open.
drop policy if exists "spk_assign teacher insert" on speaking_assignments;
do $$ begin create policy "spk_assign teacher insert" on speaking_assignments for insert
  with check (public.is_class_teacher(class_id) and public.has_active_teacher_sub((select auth.uid()))
              and not public.is_class_locked(class_id)); exception when duplicate_object then null; end $$;

-- ── 6.2 Teacher-only AI recommendation (parity with §5.3) ──────────────────
-- Keeps the draft off the student-readable submission row. 4 content bands only
-- (Aussprache omitted until Speechace). speaking_submission_owner() exists (0009).
create table if not exists speaking_ai_recommendations (
  submission_id uuid primary key references speaking_submissions(id) on delete cascade,
  recommended   jsonb not null,   -- { erfuellung, kohaerenz, wortschatz, strukturen } bands A–E + rationale
  model         text,             -- transcription + grader model ids
  created_at    timestamptz not null default now()
);
alter table speaking_ai_recommendations enable row level security;
do $$ begin create policy "spk_ai teacher read" on speaking_ai_recommendations for select
  using (public.app_teacher_can_read(public.speaking_submission_owner(submission_id))); exception when duplicate_object then null; end $$;
-- NO student policy. Service-role writes (finalize route).

-- ── transcribe_budget_hit() — Groq Whisper cost breaker (fail-closed) ───────
-- Mirrors grade_budget_hit() EXACTLY (0007) against the real app_global_rate_limits
-- ledger — the illustrative DDL in 03 §3.3 (bucket/window_key/hits) does NOT match
-- this repo. Called on /api/speaking/finalize before Whisper; owner-role (DATABASE_URL).
create or replace function public.transcribe_budget_hit(p_limit integer default 2000, p_window_seconds integer default 86400)
returns table (limited boolean, retry_after integer)
language plpgsql security definer set search_path = public as $$
declare
  v_now   bigint := floor(extract(epoch from now()))::bigint;
  v_start bigint := v_now - (v_now % p_window_seconds);
  v_count integer;
begin
  insert into app_global_rate_limits (bucket, window_start, count)
  values ('transcribe:global', v_start, 1)
  on conflict (bucket, window_start) do update set count = app_global_rate_limits.count + 1
  returning count into v_count;
  if v_count > p_limit then return query select true, (v_start + p_window_seconds - v_now)::integer;
  else return query select false, 0; end if;
end $$;
revoke all on function public.transcribe_budget_hit(integer,integer) from public, anon, authenticated;  -- Owner/Service-Role-only

notify pgrst, 'reload schema';
