-- ============================================================
--  0016 — Teacher activation: plan tiers + caps, class-dashboard visibility (D3),
--         teacher readiness (security_invoker fix), class term duration (D13).
--  Additive on the APPLIED 0001–0015. RLS default-deny idiom; every create
--  policy/enum in its own guarded do-block. Canonical names per teacher-lms/02 §1.
--  Depends on: 0008 (entitlements/classes/app_teacher_can_read), 0013 (v_readiness CTE).
-- ============================================================

set check_function_bodies = off;   -- functions reference later objects / base tables

-- ── 1.1 Plan tier + caps on entitlements (teacher-lms/02 §1.1) ─────────────
do $$ begin create type teacher_plan as enum ('starter','pro'); exception when duplicate_object then null; end $$;

alter table entitlements
  add column if not exists plan teacher_plan not null default 'starter';

-- Caps per plan. NULL = unlimited (pro, soft fair-use only). starter (€99):
-- 3 classes / 60 active students / NO org (0 seats). pro (€249): unlimited
-- classes/students but a HARD 20 teacher-seat cap (§16, 0026).
create or replace function public.plan_limits(p_plan teacher_plan)
returns table (max_classes int, max_students int, max_seats int)
language sql immutable as $$
  select case p_plan when 'starter' then 3   else null end,
         case p_plan when 'starter' then 60  else null end,
         case p_plan when 'starter' then 0   else 20   end;
$$;

-- The teacher's current plan (only while the sub is active; else 'starter' floor
-- so caps still apply to an over-cap lapsed teacher).
create or replace function public.teacher_plan_of(p_teacher uuid)
returns teacher_plan language sql stable security definer set search_path = public as $$
  select coalesce(
    (select plan from entitlements
      where user_id = p_teacher and kind = 'teacher_subscription'
        and status = 'active' and (current_period_end is null or current_period_end > now())
      limit 1),
    'starter');
$$;
revoke all on function public.teacher_plan_of(uuid) from public, anon;
grant execute on function public.teacher_plan_of(uuid) to authenticated;

-- Distinct active students across the teacher's non-archived classes (60-cap denominator).
create or replace function public.teacher_active_student_count(p_teacher uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct e.student_id)::int
  from classes c join class_enrollments e on e.class_id = c.id
  where c.teacher_id = p_teacher and c.archived_at is null and e.status = 'active';
$$;
revoke all on function public.teacher_active_student_count(uuid) from public, anon;
grant execute on function public.teacher_active_student_count(uuid) to authenticated;

-- ── 1.2 Hard class-count cap (BEFORE INSERT trigger, teacher-lms/02 §1.2) ───
-- Grandfather: fires only on INSERT → a pro→starter teacher keeps existing classes
-- but cannot create beyond cap. Student cap is cross-table → lives in the invite/
-- join paths (0017), not here.
create or replace function public.trg_enforce_class_cap() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_max int; v_count int;
begin
  select max_classes into v_max from public.plan_limits(public.teacher_plan_of(new.teacher_id));
  if v_max is not null then
    select count(*) into v_count from classes where teacher_id = new.teacher_id and archived_at is null;
    if v_count >= v_max then
      raise exception 'class_limit_reached' using errcode = 'P0001',
        detail = format('plan cap %s classes', v_max);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists enforce_class_cap on classes;
create trigger enforce_class_cap before insert on classes
  for each row execute function public.trg_enforce_class_cap();

-- ── 1.3 Class-dashboard teacher visibility (D3, teacher-lms/02 §1.3) ────────
-- Replace the 0008 assignment-scoped exam_results read with the whole dashboard
-- (all built-in sim scores of an enrolled student); drop the granular ad-hoc drill
-- reads (attempts/progress) — those reach the teacher only via teacher_student_readiness().
-- KEEP daily_activity ("daily teacher read") + profiles ("profiles teacher read").
drop policy if exists "exam_results teacher read" on exam_results;
do $$ begin create policy "exam_results teacher dashboard" on exam_results for select to authenticated
  using (public.app_teacher_can_read(user_id)); exception when duplicate_object then null; end $$;

drop policy if exists "attempts teacher read"  on exercise_attempts;
drop policy if exists "progress teacher read"  on exercise_progress;

-- ── 1.4 teacher_student_readiness() — the security_invoker fix (§1.4, §6) ───
-- v_readiness/snapshot_readiness() are security_invoker → a teacher querying them
-- gets THEIR OWN numbers. _readiness_for(uid) is a SECURITY DEFINER helper holding
-- ONE copy of the v_readiness CTE (parameterized to _uid, explicit user filters
-- since definer bypasses RLS). It is REVOKED from every client — only the gated
-- teacher_student_readiness() (and future definer callers) may use it. v_readiness
-- and snapshot_readiness stay untouched; a CI assertion pins _readiness_for == the
-- view for the same user (teacher-lms/06 §5.2).
create or replace function public._readiness_for(_uid uuid)
returns table (module text, score int)
language sql stable security definer set search_path = public as $$
  with cat as (
    select r.id, (case r.skill_code when 'shared' then 'konnektoren' else r.skill_code::text end) as module
    from redemittel r
    where r.parent_id is null
      and r.level <= coalesce((select level from profiles where id = _uid), 'B1'::cefr_level)
  ),
  strengths as (
    select cat.module,
      case when ep.mastered_at is null then 0::numeric
           else (case when coalesce(ep.first_try_correct, false) then 1.0 else 0.7 end)
                * greatest(0.30, power(2, - (extract(epoch from (now() - coalesce(ep.last_correct_at, ep.mastered_at))) / 86400.0)
                                            / least(21, greatest(1, 3 * power(2, coalesce(ep.recall_count,0))))))
      end as strength
    from cat left join exercise_progress ep on ep.item_id = cat.id and ep.user_id = _uid
  ),
  practice as (
    select module, avg(strength) as frac from strengths group by module
  ),
  latest as (
    select distinct on (simulation_id, aufgabe) simulation_id, gesamtpunkte, max_punkte
    from exam_results where user_id = _uid and simulation_id is not null
    order by simulation_id, aufgabe, created_at desc
  ),
  exam as (
    select avg(sim_ratio) as ratio from (
      select simulation_id, sum(gesamtpunkte) / nullif(sum(max_punkte),0) as sim_ratio
      from latest group by simulation_id
    ) s
  )
  select p.module,
    case when p.module = 'schreiben' and (select ratio from exam) is not null
         then round(100 * (0.6 * p.frac + 0.4 * (select ratio from exam)))::int
         else round(100 * p.frac)::int
    end as score
  from practice p;
$$;
revoke all on function public._readiness_for(uuid) from public, anon, authenticated;

-- The teacher-facing entry: a named STUDENT's readiness, gated by the canonical
-- teacher-read gate; raises 42501 for a non-entitled teacher.
create or replace function public.teacher_student_readiness(_student uuid)
returns table (module text, score smallint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.app_teacher_can_read(_student) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select r.module, r.score::smallint from public._readiness_for(_student) r;
end $$;
revoke all on function public.teacher_student_readiness(uuid) from public, anon;
grant execute on function public.teacher_student_readiness(uuid) to authenticated;

-- ── 1.5 Teacher/admin read on readiness_snapshots (§1.5) ───────────────────
-- Powers the "+Δ diese Woche" trend without recomputation. (admin read: 0022.)
do $$ begin create policy "readiness_snap teacher read" on readiness_snapshots for select to authenticated
  using (public.app_teacher_can_read(user_id)); exception when duplicate_object then null; end $$;

-- ── 1.6 Class term duration → auto-archive + lock (D13, teacher-lms/02 §1.6) ─
-- term_start/term_end set at creation (app-layer NOT NULL for new rows; columns
-- stay nullable so legacy 0008 rows are unaffected). A class is LOCKED when
-- archived (term-close sets archived_at) OR its term has ended. New-work paths
-- consult is_class_locked(); grade/feedback routes deliberately do NOT (the
-- final-grade carve-out). The nightly close-terms cron (03 §2.9) sets archived_at.
alter table classes
  add column if not exists term_start date,
  add column if not exists term_end   date;
alter table classes drop constraint if exists classes_term_ck;
alter table classes add constraint classes_term_ck
  check (term_end is null or term_start is null or term_end >= term_start);
create index if not exists idx_classes_term_open on classes(term_end) where archived_at is null;

create or replace function public.is_class_locked(_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes c where c.id = _class
    and (c.archived_at is not null or (c.term_end is not null and c.term_end < current_date)));
$$;
revoke all on function public.is_class_locked(uuid) from public, anon;
grant execute on function public.is_class_locked(uuid) to authenticated;

notify pgrst, 'reload schema';
