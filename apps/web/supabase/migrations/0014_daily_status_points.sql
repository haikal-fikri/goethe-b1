-- ============================================================
--  0014 — Expose today's practice-points total on v_daily_status.
--  Additive on the APPLIED 0010 (NEVER edit it). Idempotent.
--  Home's Tagesziel card shows numbered progress "X / 30" toward the daily
--  goal instead of a bare "offen". The 30-point threshold + counting kinds
--  already live in this view's CTEs (§6 / doc 14); we just surface today's
--  running total as a column so the client needn't re-encode them.
-- ============================================================

-- Body copied verbatim from 0010_gamification.sql; only the final SELECT gains
-- `practice_points_today` (today's row of the existing `days.practice_points`).
create or replace view v_daily_status with (security_invoker = on) as
with days as (   -- per-UTC-day goal signals for the caller
  select d.day,
    (d.day = (now() at time zone 'utc')::date) as is_today,
    coalesce(d.exams_graded,0) > 0 as had_exam,
    coalesce((select sum(pe.points) from points_events pe
      where pe.user_id = d.user_id and (pe.created_at at time zone 'utc')::date = d.day
        and pe.kind in ('set_complete','first_try_bonus','flawless_bonus')),0) as practice_points,
    exists (select 1 from practice_sessions ps
      where ps.user_id = d.user_id and ps.completed_at is not null
        and (ps.completed_at at time zone 'utc')::date = d.day) as had_set
  from daily_activity d
),
goal as (
  select day, is_today, (had_exam or had_set or practice_points >= 30) as goal_met from days   -- DAILY_GOAL_POINTS
),
-- streak = consecutive days (ending today or yesterday) with goal_met, gaps-and-islands
ranked as (
  select day, goal_met,
    (day - (row_number() over (order by day))::int) as grp
  from goal where goal_met
),
runs as (
  select grp, count(*) as len, max(day) as last_day from ranked group by grp
)
-- NB: create-or-replace requires existing columns keep their name+order and new
-- ones are APPENDED — so practice_points_today goes LAST (after goal_met_today, streak).
select
  coalesce((select goal_met from goal where is_today), false) as goal_met_today,
  coalesce((select len from runs
    where last_day >= (now() at time zone 'utc')::date - 1
    order by last_day desc limit 1), 0)::int as streak,
  coalesce((select practice_points from days where is_today), 0)::int as practice_points_today;   -- 0014: heutige Übungspunkte

notify pgrst, 'reload schema';
