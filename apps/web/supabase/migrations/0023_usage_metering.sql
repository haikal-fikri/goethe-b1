-- ============================================================
--  0023 — Usage metering (fair-use, D5). usage_counters per teacher × UTC month,
--  bumped by bump_usage() (speaking finalize + writing submit routes). The soft
--  ceilings + alert/throttle + nightly sweep live in the routes (05 §fair-use);
--  this is metering only. Canonical: teacher-lms/02 §8. Depends on: 0016.
-- ============================================================

set check_function_bodies = off;

create table if not exists usage_counters (
  teacher_id           uuid   not null references auth.users(id) on delete cascade,
  period               text   not null,                 -- 'YYYY-MM' (UTC month key)
  graded_audio_seconds bigint not null default 0,
  writing_ai_grades    int    not null default 0,
  speaking_ai_grades   int    not null default 0,
  updated_at           timestamptz not null default now(),
  primary key (teacher_id, period)
);
alter table usage_counters enable row level security;
do $$ begin create policy "usage teacher select" on usage_counters for select using (teacher_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "usage admin select"   on usage_counters for select using (public.is_admin()); exception when duplicate_object then null; end $$;
-- service-role write only via bump_usage().

create or replace function public.bump_usage(p_teacher uuid, p_audio_seconds bigint default 0, p_writing int default 0, p_speaking int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare v_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  insert into usage_counters(teacher_id, period, graded_audio_seconds, writing_ai_grades, speaking_ai_grades)
  values (p_teacher, v_period, greatest(p_audio_seconds,0), greatest(p_writing,0), greatest(p_speaking,0))
  on conflict (teacher_id, period) do update set
    graded_audio_seconds = usage_counters.graded_audio_seconds + greatest(p_audio_seconds,0),
    writing_ai_grades    = usage_counters.writing_ai_grades    + greatest(p_writing,0),
    speaking_ai_grades   = usage_counters.speaking_ai_grades   + greatest(p_speaking,0),
    updated_at = now();
end $$;
revoke all on function public.bump_usage(uuid, bigint, int, int) from public, anon, authenticated;

notify pgrst, 'reload schema';
