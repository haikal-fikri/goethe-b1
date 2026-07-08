-- ============================================================
--  0013 — Sprechen feeds readiness + streak + XP; cumulative niveau.
--  Additive on the APPLIED 0010/0012 (NEVER edit those). Idempotent.
--
--  (3) record_speech_practice() gains p_success / p_first_try and now writes
--      exercise_progress (moves the Sprechen ring + overall Bereitschaft) and
--      bumps daily_activity.attempts (a Sprechen-only day sustains the streak),
--      plus an optional daily-capped 'sprechen' XP award — all success-only.
--  (5) v_readiness / snapshot_readiness() count CUMULATIVELY: all items with
--      level <= the learner's Prüfungsniveau (cefr_level enum ordering B1<B2<C1<C2
--      ≡ LEVEL_RANK), so raising the target keeps already-learned lower levels.
--  See doc 14 §4/§5/§6/§8.
-- ============================================================

set check_function_bodies = off;   -- functions reference views / redemittel

-- ============================================================
--  (3) record_speech_practice(): success → readiness + streak + XP
--  Replaces the 1-arg 0010 version. Defaults keep an un-updated client working
--  (a {p_item_id}-only PostgREST call resolves to this defaulted 3-arg function).
-- ============================================================
drop function if exists public.record_speech_practice(text);

create or replace function public.record_speech_practice(
  p_item_id   text,
  p_success   boolean default false,   -- read-aloud STT gate passed OR word-arrange checked correct
  p_first_try boolean default false    -- succeeded on the first attempt (no retries / hearts lost)
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_b      record;
  v_day    date := (now() at time zone 'utc')::date;
  v_week   text := to_char((now() at time zone 'utc'), 'IYYY"-W"IW');
  v_lesson text;
  v_spent  integer;
  v_award  integer;
begin
  if v_uid is null then perform set_config('response.status','401',true);
    return jsonb_build_object('error','unauthorized'); end if;

  -- Canonical sprechen item only (parent_id null → same items as the v_readiness
  -- denominator). lesson_id derived server-side to match record_attempt's row shape.
  select (r.skill_code || '__' || r.task_code || '__' || r.function_code)
    into v_lesson
    from redemittel r
   where r.id = p_item_id and r.parent_id is null;
  if v_lesson is null then perform set_config('response.status','404',true);
    return jsonb_build_object('error','unknown_item'); end if;

  select * into v_b from public.rl_hit('practice:speech', 120, 60);
  if v_b.limited then perform set_config('response.status','429',true);
    return jsonb_build_object('error','rate_limited','retryAfter', v_b.retry_after); end if;

  -- (existing) self-reported coverage row — unchanged.
  insert into speech_practice (user_id, item_id, practiced_at, count)
  values (v_uid, p_item_id, now(), 1)
  on conflict (user_id, item_id) do update set practiced_at = now(), count = speech_practice.count + 1;

  -- (a) READINESS: mastery only on success (mirrors record_attempt's exercise_progress write).
  if p_success then
    insert into exercise_progress as ep
      (user_id,item_id,lesson_id,attempts,correct_count,last_correct,first_try_correct,mastered_at,last_correct_at,last_seen_at)
    values (v_uid,p_item_id,v_lesson,1,1,true,p_first_try,now(),now(),now())
    on conflict (user_id,item_id) do update set
      attempts          = ep.attempts + 1,
      correct_count     = ep.correct_count + 1,
      last_correct      = true,
      first_try_correct = ep.first_try_correct,                         -- keep the first-ever signal
      mastered_at       = coalesce(ep.mastered_at, now()),
      recall_count      = ep.recall_count + (case when ep.last_correct_at is not null
                            and (ep.last_correct_at at time zone 'utc')::date < v_day then 1 else 0 end),
      last_correct_at   = now(),
      last_seen_at      = now();
  end if;

  -- (b) STREAK: count the day active (computeStreak needs attempts>0; 0010 wrote 0).
  --     Every item advance counts as activity; correct only when the attempt succeeded.
  insert into daily_activity as da (user_id, day, attempts, correct_count)
  values (v_uid, v_day, 1, (p_success)::int)
  on conflict (user_id, day) do update set
    attempts = da.attempts + 1, correct_count = da.correct_count + (p_success)::int;

  -- (c) XP: reuse the existing 'sprechen' points_kind; success-only; SPEECH_DAILY_CAP=30/day.
  --     Excluded from v_daily_status.practice_points, so self-report can't satisfy the daily goal.
  if p_success then
    select coalesce(sum(points),0) into v_spent from points_events
      where user_id = v_uid and kind = 'sprechen'
        and (created_at at time zone 'utc')::date = v_day;
    if v_spent < 30 then
      v_award := least(5, 30 - v_spent);                               -- SPEECH_PTS=5, capped to 30/day
      insert into points_events (user_id, kind, points, ref_id, week_key)
        values (v_uid, 'sprechen', v_award, p_item_id, v_week);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'success', p_success);
end $$;
revoke all on function public.record_speech_practice(text,boolean,boolean) from public, anon;
grant  execute on function public.record_speech_practice(text,boolean,boolean) to authenticated;

-- ============================================================
--  (5) Cumulative readiness — level <= Prüfungsniveau (was exact =).
--  Recreate BOTH the view and the cron fn (they duplicate the cat CTE; changing
--  only one desyncs the "+Δ diese Woche" trend). Decay math copied verbatim from 0012.
-- ============================================================
create or replace view v_readiness with (security_invoker = on) as
with cat as (
  select r.id, (case r.skill_code when 'shared' then 'konnektoren' else r.skill_code::text end) as module
  from redemittel r
  where r.parent_id is null                                            -- canonical only (BUG-5 denominator)
    and r.level <= coalesce((select level from profiles where id = auth.uid()), 'B1'::cefr_level)  -- kumulativ ≤ Prüfungsniveau
),
strengths as (
  select cat.module,
    case when ep.mastered_at is null then 0::numeric
         else (case when coalesce(ep.first_try_correct, false) then 1.0 else 0.7 end)
              * greatest(0.30, power(2, - (extract(epoch from (now() - coalesce(ep.last_correct_at, ep.mastered_at))) / 86400.0)
                                          / least(21, greatest(1, 3 * power(2, coalesce(ep.recall_count,0))))))
    end as strength
  from cat left join exercise_progress ep on ep.item_id = cat.id
),
practice as (
  select module, avg(strength) as frac from strengths group by module
),
latest as (
  select distinct on (simulation_id, aufgabe) simulation_id, gesamtpunkte, max_punkte
  from exam_results where simulation_id is not null
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

create or replace function public.snapshot_readiness()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer := 0; v_uid uuid; v_today date := (now() at time zone 'utc')::date;
  v_s numeric; v_p numeric; v_k numeric; v_overall numeric;
begin
  for v_uid in (select distinct user_id from exercise_progress
                union select distinct user_id from exam_results) loop
    with cat as (
      select r.id, (case r.skill_code when 'shared' then 'konnektoren' else r.skill_code::text end) as module
      from redemittel r
      where r.parent_id is null
        and r.level <= coalesce((select level from profiles where id = v_uid), 'B1'::cefr_level)   -- kumulativ ≤ Prüfungsniveau
    ),
    strengths as (
      select cat.module,
        case when ep.mastered_at is null then 0::numeric
             else (case when coalesce(ep.first_try_correct,false) then 1.0 else 0.7 end)
                  * greatest(0.30, power(2, - (extract(epoch from (now() - coalesce(ep.last_correct_at, ep.mastered_at))) / 86400.0)
                                              / least(21, greatest(1, 3 * power(2, coalesce(ep.recall_count,0))))))
        end as strength
      from cat left join exercise_progress ep on ep.item_id = cat.id and ep.user_id = v_uid
    ),
    pr as (select module, avg(strength) as frac from strengths group by module)
    select max(case when module='schreiben' then frac end),
           max(case when module='sprechen'  then frac end),
           max(case when module='konnektoren' then frac end)
      into v_s, v_p, v_k from pr;

    v_s := coalesce(v_s,0); v_p := coalesce(v_p,0); v_k := coalesce(v_k,0);
    v_s := (select case when (select avg(sr) from (
              select sum(gesamtpunkte)/nullif(sum(max_punkte),0) as sr
              from (select distinct on (simulation_id,aufgabe) simulation_id,gesamtpunkte,max_punkte
                    from exam_results where user_id=v_uid and simulation_id is not null
                    order by simulation_id,aufgabe,created_at desc) l group by simulation_id) e) is not null
            then 0.6*v_s + 0.4*(select avg(sr) from (
              select sum(gesamtpunkte)/nullif(sum(max_punkte),0) as sr
              from (select distinct on (simulation_id,aufgabe) simulation_id,gesamtpunkte,max_punkte
                    from exam_results where user_id=v_uid and simulation_id is not null
                    order by simulation_id,aufgabe,created_at desc) l2 group by simulation_id) e2)
            else v_s end);
    v_overall := 0.5*v_s + 0.25*v_p + 0.25*v_k;

    insert into readiness_snapshots (user_id, captured_on, overall, schreiben, sprechen, konnektoren)
    values (v_uid, v_today, round(100*v_overall), round(100*v_s), round(100*v_p), round(100*v_k))
    on conflict (user_id, captured_on) do update set
      overall=excluded.overall, schreiben=excluded.schreiben, sprechen=excluded.sprechen, konnektoren=excluded.konnektoren;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.snapshot_readiness() from public, anon, authenticated;

notify pgrst, 'reload schema';
