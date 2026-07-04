-- ============================================================
--  0012 — Gamification v2: Daily Mix (cross-module regain set), grounded
--  growing base-2 half-life decay, recall_count, min-6 example padding.
--  Additive on the APPLIED 0010 (NEVER edit 0010) + 0011 (redemittel_practice,
--  parent_id). Idempotent. Consolidates the start_set/complete_set/record_attempt
--  overhaul here (all co-touch these functions). See doc 14 §3.4/§5.1/§8/§9 + 13 §10.
--
--  ⚠ readiness now filters `parent_id is null` so example children never inflate the
--    ~414-item canonical denominator (BUG-5 integrity).
-- ============================================================

set check_function_bodies = off;   -- functions forward-reference views / new enum value

-- ── new enum value (own statement; psql autocommits so it's usable below) ────────
alter type points_kind add value if not exists 'daily_mix_bonus';

-- ── additive column: spaced recalls grow the readiness half-life (§5.1) ──────────
alter table exercise_progress add column if not exists recall_count smallint not null default 0;

-- ── daily-mix idempotency (once-per-UTC-day bonus + "done today" state) ──────────
create table if not exists daily_mix_runs (
  user_id       uuid not null references auth.users(id) on delete cascade,
  run_on        date not null,                          -- UTC day the mix was seeded
  session_id    uuid references practice_sessions(id) on delete set null,
  bonus_awarded boolean not null default false,         -- DAILY_MIX_BONUS granted this day?
  completed_at  timestamptz,
  primary key (user_id, run_on)                          -- one row per user per UTC day
);
alter table daily_mix_runs enable row level security;
do $$ begin create policy "daily_mix select own" on daily_mix_runs for select using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "daily_mix delete own" on daily_mix_runs for delete using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
revoke insert, update on daily_mix_runs from authenticated, anon;   -- nur start_set/complete_set schreiben

-- ============================================================
--  start_set(): + redemittel_practice pool, MIN_QUESTIONS=6 padding, daily_mix mode
-- ============================================================
create or replace function public.start_set(
  p_lesson_id text, p_mode text default 'category', p_size integer default null,
  p_level_scope text default 'exam'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_b      record;
  v_max    integer := least(coalesce(p_size, 12), 12);      -- SET_MAX = 12
  v_items  text[];
  v_pad    text[];
  v_module text;
  v_hearts smallint;
  v_sid    uuid;
  v_lvl    text;
  v_lesson_id text;
  v_today  date := (now() at time zone 'utc')::date;
  v_existing_sid uuid;
  v_ps     practice_sessions%rowtype;
  v_skip_insert boolean := false;
begin
  if v_uid is null then perform set_config('response.status','401',true);
    return jsonb_build_object('error','unauthorized'); end if;
  select level::text into v_lvl from profiles where id = v_uid;
  v_lvl := coalesce(v_lvl, 'B1');
  -- session lesson_id is server-fixed: daily_mix/review force a stable key (lesson_id
  -- is NOT NULL and complete_set keys the daily-mix bonus off lesson_id='daily_mix').
  v_lesson_id := case p_mode when 'daily_mix' then 'daily_mix'
                             when 'review'    then coalesce(p_lesson_id, 'review')
                             else p_lesson_id end;

  select * into v_b from public.rl_hit('practice:start_set', 30, 60);
  if v_b.limited then perform set_config('response.status','429',true);
    perform set_config('response.headers', json_build_array(json_build_object('Retry-After', v_b.retry_after::text))::text, true);
    return jsonb_build_object('error','rate_limited','retryAfter', v_b.retry_after); end if;
  select * into v_b from public.rl_hit('practice:start_set:day', 300, 86400);
  if v_b.limited then perform set_config('response.status','429',true);
    return jsonb_build_object('error','rate_limited','retryAfter', v_b.retry_after); end if;

  if p_mode = 'daily_mix' then
    -- ── Daily Mix: cross-module regain set, day-seeded (no reroll within a UTC day) ──
    select dmr.session_id into v_existing_sid from daily_mix_runs dmr
      where dmr.user_id = v_uid and dmr.run_on = v_today;
    if v_existing_sid is not null then
      select * into v_ps from practice_sessions where id = v_existing_sid;
      if v_ps.id is not null and v_ps.completed_at is null then
        -- resume the in-progress mix as-is (no reroll)
        v_sid := v_ps.id; v_items := v_ps.item_ids; v_hearts := v_ps.hearts_left; v_module := v_ps.module;
        v_skip_insert := true;
      elsif v_ps.id is not null then
        -- prior run completed → new session, SAME items (no reroll); bonus already guarded
        v_items := v_ps.item_ids; v_module := v_ps.module;
      end if;
    end if;
    if not v_skip_insert and (v_items is null or cardinality(v_items) = 0) then
      v_module := 'schreiben';   -- informational label for a mixed set
      -- weakest-first (most-decayed touched → then unseen), interleaved across modules
      select array_agg(id) into v_items from (
        select rp.id
        from redemittel_practice rp
        left join exercise_progress ep on ep.item_id = rp.id and ep.user_id = v_uid
        where rp.level::text = v_lvl
        order by
          row_number() over (
            partition by (case rp.skill_code when 'shared' then 'konnektoren' else rp.skill_code::text end)
            order by (ep.mastered_at is null), coalesce(ep.last_correct_at, ep.mastered_at) asc nulls first
          ),
          rp.skill_code
        limit 12                                                  -- DAILY_MIX_SIZE
      ) q;
    end if;
    if not v_skip_insert then v_hearts := 4; end if;              -- DAILY_MIX_HEARTS

  elsif p_mode = 'review' then
    -- Review (legacy; superseded by Daily Mix in the UI): most-decayed mastered items.
    v_module := 'schreiben';
    select array_agg(id) into v_items from (
      select rp.id
      from redemittel_practice rp
      join exercise_progress ep on ep.item_id = rp.id and ep.user_id = v_uid
      where rp.parent_id is null and rp.level::text = v_lvl and ep.mastered_at is not null
      order by coalesce(ep.last_correct_at, ep.mastered_at) asc
      limit v_max
    ) q;

  else
    -- ── Category: one lesson (skill__task__function); canonical first, then example
    --    children to pad thin categories up to MIN_QUESTIONS=6 (cap SET_MAX). ──
    v_module := case split_part(p_lesson_id,'__',1) when 'shared' then 'konnektoren' else split_part(p_lesson_id,'__',1) end;
    select array_agg(id) into v_items from (
      select rp.id
      from redemittel_practice rp
      left join exercise_progress ep on ep.item_id = rp.id and ep.user_id = v_uid
      where rp.parent_id is null
        and (rp.skill_code || '__' || rp.task_code || '__' || rp.function_code) = p_lesson_id
        and (case p_level_scope
               when 'b2plus' then rp.level >= 'B2'::cefr_level
               when 'c1plus' then rp.level >= 'C1'::cefr_level
               when 'all'    then true
               else rp.level::text = v_lvl end)
      order by (ep.mastered_at is not null),
               coalesce(ep.last_correct_at, ep.mastered_at) asc nulls first
      limit v_max
    ) q;
    v_items := coalesce(v_items, '{}');
    if cardinality(v_items) < 6 then                              -- MIN_QUESTIONS = 6
      select array_agg(id) into v_pad from (
        select rp.id
        from redemittel_practice rp
        where rp.parent_id is not null                            -- practiceable example children
          and (rp.skill_code || '__' || rp.task_code || '__' || rp.function_code) = p_lesson_id
          and (case p_level_scope
                 when 'b2plus' then rp.level >= 'B2'::cefr_level
                 when 'c1plus' then rp.level >= 'C1'::cefr_level
                 when 'all'    then true
                 else rp.level::text = v_lvl end)
          and not (rp.id = any(v_items))
        order by rp.id
        limit (6 - cardinality(v_items))
      ) q2;
      v_items := v_items || coalesce(v_pad, '{}');
    end if;
  end if;

  v_items := coalesce(v_items, '{}');
  if not v_skip_insert then
    if cardinality(v_items) = 0 then perform set_config('response.status','404',true);
      return jsonb_build_object('error','no_items'); end if;
    v_items := v_items[1:v_max];                                  -- enforce SET_MAX
    if p_mode <> 'daily_mix' then
      v_hearts := case when cardinality(v_items) <= 8 then 3 else 4 end;   -- HEARTS_START two-tier
    end if;
    insert into practice_sessions (user_id, lesson_id, module, item_ids, hearts_start, hearts_left)
    values (v_uid, v_lesson_id, v_module, v_items, v_hearts, v_hearts)
    returning id into v_sid;
    if p_mode = 'daily_mix' then
      insert into daily_mix_runs (user_id, run_on, session_id, bonus_awarded)
      values (v_uid, v_today, v_sid, false)
      on conflict (user_id, run_on) do update set session_id = excluded.session_id;
    end if;
  end if;

  -- {session_id, hearts, module, items:[{id, kind}]} — kind fixed per item by id-hash.
  return jsonb_build_object(
    'session_id', v_sid,
    'hearts', v_hearts,
    'module', v_module,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', it,
        'kind', case when right(it,1) ~ '^[0-9a-fA-F]$'
                       and (('x' || right(it,1))::bit(4)::int) % 2 = 0 then 'wordbank' else 'cloze' end
      ) order by ord), '[]'::jsonb)
      from unnest(v_items) with ordinality as u(it, ord)
    )
  );
end $$;
revoke all on function public.start_set(text,text,integer,text) from public, anon;
grant  execute on function public.start_set(text,text,integer,text) to authenticated;

-- ============================================================
--  complete_set(): + daily-mix once-per-day bonus branch
-- ============================================================
create or replace function public.complete_set(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s          practice_sessions%rowtype;
  v_week       text := to_char((now() at time zone 'utc'), 'IYYY"-W"IW');
  v_today      date := (now() at time zone 'utc')::date;
  v_flawless   boolean;
  v_is_repeat  boolean;
  v_repeat_today integer;
  v_base       integer;
  v_first      integer := 0;
  v_flaw       integer := 0;
  v_spent_today integer;
  v_total      integer;
  v_goal_done  boolean;
  v_dmix_bonus integer := 0;
  v_dmr        daily_mix_runs%rowtype;
begin
  select * into v_s from practice_sessions where id = p_session_id;
  if v_s.id is null then return jsonb_build_object('error','unknown_session'); end if;
  if v_s.completed_at is not null then
    return jsonb_build_object('completed', true, 'points', coalesce(v_s.points_awarded,0), 'flawless', v_s.flawless); end if;

  v_flawless := (v_s.hearts_left = v_s.hearts_start);

  select exists (select 1 from practice_sessions
    where user_id = v_s.user_id and lesson_id = v_s.lesson_id and completed_at is not null and id <> v_s.id)
    into v_is_repeat;
  select count(*) into v_repeat_today from practice_sessions
    where user_id = v_s.user_id and lesson_id = v_s.lesson_id and id <> v_s.id
      and (completed_at at time zone 'utc')::date = v_today;

  if not v_is_repeat then
    v_base  := 25;                                   -- SET_BASE
    v_first := 5 * v_s.first_try_ok;                 -- FIRST_TRY_PTS × first-try items
    v_flaw  := case when v_flawless then 15 else 0 end;   -- FLAWLESS_BONUS
  elsif v_repeat_today = 0 then
    v_base  := round(0.25 * 25);                     -- REPEAT_FACTOR × SET_BASE
  else
    v_base  := 0;
  end if;

  v_total := v_base + v_first + v_flaw;

  select coalesce(sum(points),0) into v_spent_today from points_events
    where user_id = v_s.user_id and kind in ('set_complete','first_try_bonus','flawless_bonus','daily_goal')
      and (created_at at time zone 'utc')::date = v_today;
  if v_spent_today + v_total > 300 then v_total := greatest(0, 300 - v_spent_today); end if;   -- DAILY_PRACTICE_CAP

  if v_total > 0 and v_base > 0 then
    insert into points_events (user_id, kind, points, ref_id, week_key)
      values (v_s.user_id, 'set_complete', least(v_base, v_total), v_s.id::text, v_week);
    v_total := v_total - least(v_base, v_total);
  end if;
  if v_total > 0 and v_first > 0 then
    insert into points_events (user_id, kind, points, ref_id, week_key)
      values (v_s.user_id, 'first_try_bonus', least(v_first, v_total), v_s.id::text, v_week);
    v_total := v_total - least(v_first, v_total);
  end if;
  if v_total > 0 and v_flaw > 0 then
    insert into points_events (user_id, kind, points, ref_id, week_key)
      values (v_s.user_id, 'flawless_bonus', least(v_flaw, v_total), v_s.id::text, v_week);
  end if;

  update practice_sessions set completed_at = now(), flawless = v_flawless,
    points_awarded = (v_base + v_first + v_flaw)
  where id = v_s.id;

  -- ── Daily Mix: flat DAILY_MIX_BONUS once per UTC day (uncapped; idempotent) ──
  if v_s.lesson_id = 'daily_mix' then
    select * into v_dmr from daily_mix_runs where user_id = v_s.user_id and run_on = v_today for update;
    if v_dmr.user_id is not null and not v_dmr.bonus_awarded then
      insert into points_events (user_id, kind, points, ref_id, week_key)
        values (v_s.user_id, 'daily_mix_bonus', 40, v_s.id::text, v_week);   -- DAILY_MIX_BONUS
      update daily_mix_runs set bonus_awarded = true, completed_at = now()
        where user_id = v_s.user_id and run_on = v_today;
      v_dmix_bonus := 40;
    elsif v_dmr.user_id is not null then
      update daily_mix_runs set completed_at = coalesce(completed_at, now())
        where user_id = v_s.user_id and run_on = v_today;
    end if;
  end if;

  select exists (select 1 from points_events where user_id = v_s.user_id and kind = 'daily_goal'
    and (created_at at time zone 'utc')::date = v_today) into v_goal_done;
  if not v_goal_done then
    insert into points_events (user_id, kind, points, ref_id, week_key)
      values (v_s.user_id, 'daily_goal', 20, v_s.id::text, v_week);   -- DAILY_GOAL_BONUS
  end if;

  return jsonb_build_object('completed', true, 'points', (v_base + v_first + v_flaw),
    'flawless', v_flawless, 'first_try_ok', v_s.first_try_ok, 'hearts_left', v_s.hearts_left,
    'daily_mix_bonus', v_dmix_bonus);
end $$;
revoke all on function public.complete_set(uuid) from public, anon, authenticated;

-- ============================================================
--  record_attempt(): + recall_count bump + example-credits-parent
-- ============================================================
create or replace function public.record_attempt(
  p_item_id text, p_lesson_id text, p_kind exercise_kind,
  p_submitted_tokens text[] default '{}', p_duration_ms integer default null,
  p_session_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_b   record;
  v_day date := (now() at time zone 'utc')::date;
  v_correct boolean;
  v_tokens  text[];
  v_cloze   text[];
  v_parent  text;
  v_s       practice_sessions%rowtype;
  v_is_first boolean := false;
  v_completed boolean := false;
  v_remaining integer := null;
  v_complete jsonb;
begin
  if v_uid is null then perform set_config('response.status','401',true);
    return jsonb_build_object('error','unauthorized'); end if;
  if p_kind not in ('wordbank','cloze') then perform set_config('response.status','400',true);
    return jsonb_build_object('error','invalid_kind'); end if;

  select * into v_b from public.rl_hit('progress:attempt', 120, 60);
  if v_b.limited then perform set_config('response.status','429',true);
    perform set_config('response.headers', json_build_array(json_build_object('Retry-After', v_b.retry_after::text))::text, true);
    return jsonb_build_object('error','rate_limited','retryAfter', v_b.retry_after); end if;
  select * into v_b from public.rl_hit('progress:attempt:day', 3000, 86400);
  if v_b.limited then perform set_config('response.status','429',true);
    return jsonb_build_object('error','rate_limited','retryAfter', v_b.retry_after); end if;

  select tokens, parent_id into v_tokens, v_parent from redemittel where id = p_item_id;
  if v_tokens is null then perform set_config('response.status','404',true);
    return jsonb_build_object('error','unknown_item'); end if;

  if p_kind = 'wordbank' then
    v_correct := (coalesce(p_submitted_tokens,'{}') = v_tokens);
  else
    select array_agg(mm.match[1] order by mm.ord)
      into v_cloze
      from redemittel rr,
           lateral regexp_matches(rr.cloze_template, '\{\{([^}]+)\}\}', 'g') with ordinality as mm(match, ord)
     where rr.id = p_item_id;
    v_correct := (coalesce(p_submitted_tokens,'{}') = coalesce(v_cloze,'{}'));
  end if;

  insert into exercise_attempts (user_id,item_id,lesson_id,kind,correct,submitted_tokens,duration_ms)
  values (v_uid,p_item_id,p_lesson_id,p_kind,v_correct,coalesce(p_submitted_tokens,'{}'),p_duration_ms);

  -- first_try_correct set once; last_correct_at resets decay; recall_count bumps once/UTC-day.
  insert into exercise_progress as ep (user_id,item_id,lesson_id,attempts,correct_count,last_correct,first_try_correct,mastered_at,last_correct_at,last_seen_at)
  values (v_uid,p_item_id,p_lesson_id,1,(v_correct)::int,v_correct,v_correct, case when v_correct then now() end, case when v_correct then now() end, now())
  on conflict (user_id,item_id) do update set
    attempts=ep.attempts+1, correct_count=ep.correct_count+(v_correct)::int,
    last_correct=v_correct, first_try_correct=ep.first_try_correct,
    mastered_at=coalesce(ep.mastered_at, case when v_correct then now() end),
    recall_count = ep.recall_count + (case when v_correct and ep.last_correct_at is not null
                                            and (ep.last_correct_at at time zone 'utc')::date < v_day then 1 else 0 end),
    last_correct_at=case when v_correct then now() else ep.last_correct_at end, last_seen_at=now();

  -- Example-credits-parent: mastering an example child lifts its parent Wendung's
  -- strength (§4/§5.1). Dormant until example children are made practiceable.
  if v_correct and v_parent is not null then
    insert into exercise_progress as ep (user_id,item_id,lesson_id,attempts,correct_count,last_correct,mastered_at,last_correct_at,last_seen_at)
    values (v_uid,v_parent,p_lesson_id,0,0,true,now(),now(),now())
    on conflict (user_id,item_id) do update set
      last_correct=true, mastered_at=coalesce(ep.mastered_at, now()),
      recall_count = ep.recall_count + (case when ep.last_correct_at is not null
                                              and (ep.last_correct_at at time zone 'utc')::date < v_day then 1 else 0 end),
      last_correct_at=now(), last_seen_at=now();
  end if;

  insert into daily_activity as da (user_id,day,attempts,correct_count)
  values (v_uid,v_day,1,(v_correct)::int)
  on conflict (user_id,day) do update set
    attempts=da.attempts+1, correct_count=da.correct_count+(v_correct)::int;

  if p_session_id is not null then
    select * into v_s from practice_sessions where id = p_session_id and user_id = v_uid and completed_at is null for update;
    if v_s.id is not null then
      v_is_first := not (p_item_id = any(v_s.attempted_ids));
      update practice_sessions set
        attempted_ids = case when v_is_first then array_append(attempted_ids, p_item_id) else attempted_ids end,
        first_try_ok  = first_try_ok + (case when v_is_first and v_correct then 1 else 0 end),
        hearts_left   = greatest(0, hearts_left - (case when v_is_first and not v_correct then 1 else 0 end)),
        mastered_ids  = case when v_correct and not (p_item_id = any(mastered_ids)) then array_append(mastered_ids, p_item_id) else mastered_ids end,
        last_activity = now()
      where id = v_s.id
      returning * into v_s;

      v_remaining := cardinality(v_s.item_ids) - cardinality(v_s.mastered_ids);
      if v_remaining <= 0 then
        v_complete := public.complete_set(v_s.id);
        v_completed := true;
      end if;
    end if;
  end if;

  return jsonb_build_object('ok',true,'correct',v_correct,
    'hearts_left', v_s.hearts_left, 'remaining', v_remaining, 'completed', v_completed, 'result', v_complete);
end $$;
revoke all on function public.record_attempt(text,text,exercise_kind,text[],integer,uuid) from public, anon;
grant  execute on function public.record_attempt(text,text,exercise_kind,text[],integer,uuid) to authenticated;

-- ============================================================
--  Readiness: grounded growing base-2 half-life (§5.1) + parent_id-null filter
-- ============================================================
create or replace view v_readiness with (security_invoker = on) as
with cat as (
  select r.id, (case r.skill_code when 'shared' then 'konnektoren' else r.skill_code::text end) as module
  from redemittel r
  where r.parent_id is null                                         -- canonical only (BUG-5 denominator)
    and r.level::text = coalesce((select level::text from profiles where id = auth.uid()), 'B1')
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

-- ── snapshot_readiness(): daily cron — same decay math, per user ─────────────────
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
        and r.level::text = coalesce((select level::text from profiles where id = v_uid), 'B1')
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
