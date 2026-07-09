-- ============================================================
--  0018 — Recurring timetable, sessions, attendance (D6).
--  A weekly schedule → materialized occurrences → per-occurrence attendance →
--  teacher may cancel an occurrence (force majeure) → enrolled students notified.
--  Canonical: teacher-lms/02 §3. Depends on: 0008 (classes/is_class_teacher/is_enrolled), 0005 (set_updated_at).
-- ============================================================

set check_function_bodies = off;

do $$ begin create type session_status    as enum ('scheduled','canceled','held');       exception when duplicate_object then null; end $$;
do $$ begin create type attendance_status as enum ('present','absent','late','excused'); exception when duplicate_object then null; end $$;

-- Weekly recurrence template (a class may have several rows, e.g. Mon + Wed).
create table if not exists class_schedules (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references classes(id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),      -- 0=Sun … 6=Sat (matches extract(dow))
  start_time   time    not null,                                       -- local wall-clock time
  duration_min smallint not null default 90 check (duration_min between 5 and 600),
  timezone     text    not null default 'Europe/Berlin',              -- IANA tz for UTC materialization
  starts_on    date    not null,
  ends_on      date,                                                   -- null = open-ended (rolling window)
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_class_schedules_class on class_schedules(class_id) where active;
drop trigger if exists trg_class_schedules_updated on class_schedules;
create trigger trg_class_schedules_updated before update on class_schedules for each row execute function public.set_updated_at();

-- Materialized occurrences (schedule_id null = ad-hoc one-off).
create table if not exists class_sessions (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references classes(id) on delete cascade,
  schedule_id   uuid references class_schedules(id) on delete set null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  title         text check (title is null or char_length(title) <= 160),
  status        session_status not null default 'scheduled',
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  canceled_at   timestamptz,
  canceled_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create unique index if not exists uq_class_sessions_sched on class_sessions(schedule_id, starts_at) where schedule_id is not null;  -- idempotent generation
create index if not exists idx_class_sessions_class on class_sessions(class_id, starts_at);

create table if not exists attendance (
  session_id  uuid not null references class_sessions(id) on delete cascade,
  student_id  uuid not null references auth.users(id)     on delete cascade,
  status      attendance_status not null,
  note        text check (note is null or char_length(note) <= 280),
  marked_by   uuid not null references auth.users(id),
  marked_at   timestamptz not null default now(),
  primary key (session_id, student_id)
);
create index if not exists idx_attendance_student on attendance(student_id);

-- Helper: is the caller the teacher of the session's class?
create or replace function public.is_session_teacher(_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_sessions s join classes c on c.id = s.class_id
    where s.id = _session and c.teacher_id = auth.uid());
$$;
revoke all on function public.is_session_teacher(uuid) from public, anon;
grant execute on function public.is_session_teacher(uuid) to authenticated;

alter table class_schedules enable row level security;
alter table class_sessions  enable row level security;
alter table attendance      enable row level security;

-- schedules: teacher CRUD own class; enrolled student reads.
do $$ begin create policy "sched teacher all" on class_schedules for all
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "sched student read" on class_schedules for select
  using (public.is_enrolled(class_id)); exception when duplicate_object then null; end $$;

-- sessions: teacher CRUD own class (ad-hoc create/edit); enrolled student reads.
--   Cancellation goes through cancel_session()/route so the notify fan-out (service-role) can fire.
do $$ begin create policy "session teacher all" on class_sessions for all
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "session student read" on class_sessions for select
  using (public.is_enrolled(class_id)); exception when duplicate_object then null; end $$;

-- attendance: teacher writes for own class's sessions; student reads OWN rows only.
do $$ begin create policy "attend teacher all" on attendance for all
  using (public.is_session_teacher(session_id))
  with check (public.is_session_teacher(session_id) and marked_by = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "attend student read" on attendance for select
  using (student_id = (select auth.uid())); exception when duplicate_object then null; end $$;

-- ── 3.1 generate_sessions() — materialize occurrences (cron/service-role) ───
-- Insert missing occurrences for active schedules up to p_until (default +6 weeks).
-- Idempotent (uq index). A student never generates.
create or replace function public.generate_sessions(p_class uuid default null, p_until date default (current_date + 42))
returns int language plpgsql security definer set search_path = public as $$
declare s record; d date; v_start timestamptz; v_ins int := 0;
begin
  for s in select * from class_schedules
           where active and (p_class is null or class_id = p_class)
             and starts_on <= p_until and (ends_on is null or ends_on >= current_date)
  loop
    d := greatest(s.starts_on, current_date);
    while d <= least(p_until, coalesce(s.ends_on, p_until)) loop
      if extract(dow from d)::int = s.weekday then
        v_start := (d + s.start_time) at time zone s.timezone;   -- local → timestamptz
        insert into class_sessions (class_id, schedule_id, starts_at, ends_at)
        values (s.class_id, s.id, v_start, v_start + make_interval(mins => s.duration_min))
        on conflict (schedule_id, starts_at) where schedule_id is not null do nothing;
        v_ins := v_ins + 1;
      end if;
      d := d + 1;
    end loop;
  end loop;
  return v_ins;
end $$;
revoke all on function public.generate_sessions(uuid, date) from public, anon, authenticated;  -- cron/service-role only

-- ── 3.2 cancel_session() — teacher cancels (force majeure) (§3.2) ──────────
-- Returns affected student_ids for the route's push fan-out.
create or replace function public.cancel_session(p_session uuid, p_reason text)
returns setof uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_session_teacher(p_session) then raise exception 'forbidden' using errcode = '42501'; end if;
  update class_sessions
     set status = 'canceled', cancel_reason = left(p_reason, 500), canceled_at = now(), canceled_by = auth.uid()
   where id = p_session and status <> 'canceled';
  return query
    select e.student_id from class_enrollments e
    join class_sessions s on s.class_id = e.class_id
    where s.id = p_session and e.status = 'active';
end $$;
revoke all on function public.cancel_session(uuid, text) from public, anon;
grant execute on function public.cancel_session(uuid, text) to authenticated;

notify pgrst, 'reload schema';
