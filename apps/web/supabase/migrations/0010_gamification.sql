-- ============================================================
--  0010 — Gamification: loop-to-mastery + hearts, points economy,
--  decaying Readiness %, streak/daily-goal (LIVE in v1).
--  Additive on 0006/0007. Content tables untouched. Same invariants:
--  RLS default-deny; scored tables have select-own + NO client write
--  (only SECURITY DEFINER RPCs/triggers write). See doc 14.
--  NB: applies AFTER 0009 in bootstrap order.
-- ============================================================

set check_function_bodies = off;   -- functions forward-reference each other / views

-- ── first-try + last-correct signals on the existing progress table ─────────────
alter table exercise_progress add column if not exists first_try_correct boolean;   -- set once, on the first-ever attempt
alter table exercise_progress add column if not exists last_correct_at   timestamptz; -- resets readiness decay; last correct answer

-- ── practice sessions (the loop-to-mastery unit; RPC-written only) ──────────────
create table if not exists practice_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  lesson_id      text not null,                       -- makeLessonId(skill,task,function) | 'review'
  module         text not null,                       -- 'schreiben' | 'sprechen' | 'konnektoren'
  item_ids       text[] not null,                     -- fixed at start; the set contents
  hearts_start   smallint not null default 3,
  hearts_left    smallint not null default 3,
  first_try_ok   integer  not null default 0,         -- items correct on their first attempt this session
  attempted_ids  text[]   not null default '{}',      -- items with ≥1 attempt this session (first-try bookkeeping)
  mastered_ids   text[]   not null default '{}',      -- items cleared this session
  points_awarded integer,                             -- null until completed
  flawless       boolean,                             -- hearts_left == hearts_start at completion
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,                          -- null = in progress/abandoned
  last_activity  timestamptz not null default now()
);
create index if not exists idx_sessions_user_open on practice_sessions(user_id, completed_at) where completed_at is null;
create index if not exists idx_sessions_user_lesson on practice_sessions(user_id, lesson_id);
alter table practice_sessions enable row level security;
do $$ begin create policy "sessions select own" on practice_sessions for select using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "sessions delete own" on practice_sessions for delete using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
-- KEIN insert/update-Policy → start_set()/record_attempt()/complete_set() sind die einzigen Schreiber.

-- ── points ledger (append-only; RPC/trigger-written only) ───────────────────────
do $$ begin create type points_kind as enum
  ('set_complete','first_try_bonus','flawless_bonus','exam','sprechen','daily_goal','streak_milestone'); exception when duplicate_object then null; end $$;
create table if not exists points_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       points_kind not null,
  points     integer not null check (points >= 0),
  ref_id     text,                                    -- session id / exam_results id
  week_key   text not null,                           -- ISO week, e.g. '2026-W27' (server-computed)
  created_at timestamptz not null default now()
);
create index if not exists idx_points_user_week on points_events(user_id, week_key);
create index if not exists idx_points_week      on points_events(week_key);
create index if not exists idx_points_user_day  on points_events(user_id, created_at);
alter table points_events enable row level security;
do $$ begin create policy "points select own" on points_events for select using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
-- KEIN insert/update/delete-Policy → append-only ledger, nur RPC/Trigger schreibt.

-- ── readiness history (daily cron snapshot; drives "+Δ diese Woche") ─────────────
create table if not exists readiness_snapshots (
  user_id     uuid not null references auth.users(id) on delete cascade,
  captured_on date not null,                          -- UTC day
  overall     smallint not null,                      -- 0..100
  schreiben   smallint not null,
  sprechen    smallint not null,
  konnektoren smallint not null,
  primary key (user_id, captured_on)
);
alter table readiness_snapshots enable row level security;
do $$ begin create policy "readiness select own" on readiness_snapshots for select using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
-- KEIN insert/update/delete-Policy → nur der Cron (Service-Role) schreibt.

-- ── self-reported speech practice (on-device 20/22; coverage-only, RPC-written) ──
create table if not exists speech_practice (
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_id      text not null references redemittel(id) on delete cascade,
  practiced_at timestamptz not null default now(),     -- last self-reported practice (drives coverage decay)
  count        integer not null default 0,             -- times pinged
  primary key (user_id, item_id)
);
alter table speech_practice enable row level security;
do $$ begin create policy "speech_practice select own" on speech_practice for select using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "speech_practice delete own" on speech_practice for delete using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
-- KEIN insert/update-Policy → nur record_speech_practice() schreibt.

-- ── HARTE INVARIANTE: keine direkten insert/update/delete-Grants für Clients ─────
-- (RLS default-privileges gewähren authenticated sonst ALL → hier entziehen, damit
--  Forge-Versuche 42501 werfen statt 0-Zeilen. delete bleibt via RLS-Policy erlaubt,
--  wo eine "delete own"-Policy existiert = practice_sessions / speech_practice.)
revoke insert, update on practice_sessions, points_events, readiness_snapshots, speech_practice from authenticated, anon;
revoke delete on points_events, readiness_snapshots from authenticated, anon;   -- Ledger/Snapshot: kein Client-Delete

-- ============================================================
--  Write paths (SECURITY DEFINER, rate-limited via rl_hit)
-- ============================================================

-- ── start_set(): server fixes the item list + kinds + hearts ────────────────────
create or replace function public.start_set(
  p_lesson_id text, p_mode text default 'category', p_size integer default null,
  p_level_scope text default 'exam'                        -- R2-3: 'exam' | 'b2plus' | 'c1plus' | 'all'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_b      record;
  v_max    integer := least(coalesce(p_size, 12), 12);      -- SET_MAX = 12
  v_items  text[];
  v_module text;
  v_hearts smallint;
  v_sid    uuid;
  v_lvl    text;                                            -- Prüfungsniveau der/des Lernenden
begin
  if v_uid is null then perform set_config('response.status','401',true);
    return jsonb_build_object('error','unauthorized'); end if;
  select level::text into v_lvl from profiles where id = v_uid;
  v_lvl := coalesce(v_lvl, 'B1');

  -- Rate-limit (in-DB; 30/min · 300/day) — set-starts are far less frequent than attempts.
  select * into v_b from public.rl_hit('practice:start_set', 30, 60);
  if v_b.limited then perform set_config('response.status','429',true);
    perform set_config('response.headers', json_build_array(json_build_object('Retry-After', v_b.retry_after::text))::text, true);
    return jsonb_build_object('error','rate_limited','retryAfter', v_b.retry_after); end if;
  select * into v_b from public.rl_hit('practice:start_set:day', 300, 86400);
  if v_b.limited then perform set_config('response.status','429',true);
    return jsonb_build_object('error','rate_limited','retryAfter', v_b.retry_after); end if;

  if p_mode = 'review' then
    -- Review: most-decayed mastered items across all B1 modules (due for review first).
    v_module := 'schreiben';   -- mixed review; module label is informational for a review set
    select array_agg(id) into v_items from (
      select r.id
      from redemittel r
      join exercise_progress ep on ep.item_id = r.id and ep.user_id = v_uid
      where r.level::text = v_lvl and ep.mastered_at is not null   -- Review = eigenes Prüfungsniveau
      order by coalesce(ep.last_correct_at, ep.mastered_at) asc
      limit v_max
    ) q;
  else
    -- Category: items of one lesson (skill__task__function); unmastered first, then due-for-review.
    v_module := case split_part(p_lesson_id,'__',1) when 'shared' then 'konnektoren' else split_part(p_lesson_id,'__',1) end;
    select array_agg(id) into v_items from (
      select r.id
      from redemittel r
      left join exercise_progress ep on ep.item_id = r.id and ep.user_id = v_uid
      where (r.skill_code || '__' || r.task_code || '__' || r.function_code) = p_lesson_id
        and (case p_level_scope                                          -- R2-3 Niveau-Filter (opt-in)
               when 'b2plus' then r.level >= 'B2'::cefr_level
               when 'c1plus' then r.level >= 'C1'::cefr_level
               when 'all'    then true
               else r.level::text = v_lvl end)                          -- 'exam' (Default) = Prüfungsniveau
      order by (ep.mastered_at is not null),                              -- unmastered (false) first
               coalesce(ep.last_correct_at, ep.mastered_at) asc nulls first
      limit v_max
    ) q;
  end if;

  v_items := coalesce(v_items, '{}');
  if cardinality(v_items) = 0 then perform set_config('response.status','404',true);
    return jsonb_build_object('error','no_items'); end if;

  v_hearts := case when cardinality(v_items) <= 8 then 3 else 4 end;      -- HEARTS_START two-tier

  insert into practice_sessions (user_id, lesson_id, module, item_ids, hearts_start, hearts_left)
  values (v_uid, p_lesson_id, v_module, v_items, v_hearts, v_hearts)
  returning id into v_sid;

  -- Return {session_id, hearts, items:[{id, kind}]} — kind fixed per item by id-hash (mirrors @repo/core pickExerciseKind).
  return jsonb_build_object(
    'session_id', v_sid,
    'hearts', v_hearts,
    'module', v_module,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', it,
        -- id-hash kind (mirrors @repo/core pickExerciseKind): real ids are 12-hex →
        -- even last nibble = wordbank, odd = cloze. Non-hex (test fixtures) → cloze,
        -- matching the TS parseInt(...,16)=NaN fallback.
        'kind', case when right(it,1) ~ '^[0-9a-fA-F]$'
                       and (('x' || right(it,1))::bit(4)::int) % 2 = 0 then 'wordbank' else 'cloze' end
      ) order by ord), '[]'::jsonb)
      from unnest(v_items) with ordinality as u(it, ord)
    )
  );
end $$;
revoke all on function public.start_set(text,text,integer,text) from public, anon;
grant  execute on function public.start_set(text,text,integer,text) to authenticated;

-- ── complete_set(): idempotent points award + anti-grind (internal) ─────────────
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
begin
  select * into v_s from practice_sessions where id = p_session_id;
  if v_s.id is null then return jsonb_build_object('error','unknown_session'); end if;
  if v_s.completed_at is not null then   -- idempotent: no double award
    return jsonb_build_object('completed', true, 'points', coalesce(v_s.points_awarded,0), 'flawless', v_s.flawless); end if;

  v_flawless := (v_s.hearts_left = v_s.hearts_start);

  -- Anti-grind: was this lesson ever completed before (a repeat)? how many times today?
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
    v_base  := round(0.25 * 25);                     -- REPEAT_FACTOR × SET_BASE, REPEAT_FREE=1/day
  else
    v_base  := 0;                                    -- further same-lesson repeats today pay nothing
  end if;

  v_total := v_base + v_first + v_flaw;

  -- Daily practice-points cap (DAILY_PRACTICE_CAP = 300; exams uncapped).
  select coalesce(sum(points),0) into v_spent_today from points_events
    where user_id = v_s.user_id and kind in ('set_complete','first_try_bonus','flawless_bonus','daily_goal')
      and (created_at at time zone 'utc')::date = v_today;
  if v_spent_today + v_total > 300 then v_total := greatest(0, 300 - v_spent_today); end if;

  -- Emit ledger rows (split into kinds up to the clamped total, base first).
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

  -- Daily-goal bonus (once/day): completing a set satisfies the goal.
  select exists (select 1 from points_events where user_id = v_s.user_id and kind = 'daily_goal'
    and (created_at at time zone 'utc')::date = v_today) into v_goal_done;
  if not v_goal_done then
    insert into points_events (user_id, kind, points, ref_id, week_key)
      values (v_s.user_id, 'daily_goal', 20, v_s.id::text, v_week);   -- DAILY_GOAL_BONUS
  end if;

  return jsonb_build_object('completed', true, 'points', (v_base + v_first + v_flaw),
    'flawless', v_flawless, 'first_try_ok', v_s.first_try_ok, 'hearts_left', v_s.hearts_left);
end $$;
revoke all on function public.complete_set(uuid) from public, anon, authenticated;   -- internal (called by record_attempt)

-- ── record_attempt(): now session-aware. Replaces the 0007 5-arg version. ───────
drop function if exists public.record_attempt(text,text,exercise_kind,text[],integer);
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
  v_s       practice_sessions%rowtype;
  v_is_first boolean := false;
  v_completed boolean := false;
  v_remaining integer := null;
  v_complete jsonb;
begin
  if v_uid is null then perform set_config('response.status','401',true);
    return jsonb_build_object('error','unauthorized'); end if;
  if p_kind not in ('wordbank','cloze') then perform set_config('response.status','400',true);
    return jsonb_build_object('error','invalid_kind'); end if;   -- on-device Sprechen speichert nichts

  -- Ratenbegrenzung (in-DB; PostgREST liefert 429 aus dem response.status-GUC).
  select * into v_b from public.rl_hit('progress:attempt', 120, 60);
  if v_b.limited then perform set_config('response.status','429',true);
    perform set_config('response.headers', json_build_array(json_build_object('Retry-After', v_b.retry_after::text))::text, true);
    return jsonb_build_object('error','rate_limited','retryAfter', v_b.retry_after); end if;
  select * into v_b from public.rl_hit('progress:attempt:day', 3000, 86400);
  if v_b.limited then perform set_config('response.status','429',true);
    return jsonb_build_object('error','rate_limited','retryAfter', v_b.retry_after); end if;

  -- SERVERSEITIGE Korrektheit (nie dem Client vertrauen).
  select tokens into v_tokens from redemittel where id = p_item_id;
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

  -- first_try_correct set once on first-ever attempt (kept on conflict); last_correct_at resets decay.
  insert into exercise_progress as ep (user_id,item_id,lesson_id,attempts,correct_count,last_correct,first_try_correct,mastered_at,last_correct_at,last_seen_at)
  values (v_uid,p_item_id,p_lesson_id,1,(v_correct)::int,v_correct,v_correct, case when v_correct then now() end, case when v_correct then now() end, now())
  on conflict (user_id,item_id) do update set
    attempts=ep.attempts+1, correct_count=ep.correct_count+(v_correct)::int,
    last_correct=v_correct, first_try_correct=ep.first_try_correct,
    mastered_at=coalesce(ep.mastered_at, case when v_correct then now() end),
    last_correct_at=case when v_correct then now() else ep.last_correct_at end, last_seen_at=now();

  insert into daily_activity as da (user_id,day,attempts,correct_count)
  values (v_uid,v_day,1,(v_correct)::int)
  on conflict (user_id,day) do update set
    attempts=da.attempts+1, correct_count=da.correct_count+(v_correct)::int;

  -- ── Session bookkeeping (hearts / first-try / requeue-completion) ──
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

-- ── record_speech_practice(): on-device 20/22 self-report (coverage-only) ───────
create or replace function public.record_speech_practice(p_item_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_b   record;
  v_day date := (now() at time zone 'utc')::date;
begin
  if v_uid is null then perform set_config('response.status','401',true);
    return jsonb_build_object('error','unauthorized'); end if;
  if not exists (select 1 from redemittel where id = p_item_id) then perform set_config('response.status','404',true);
    return jsonb_build_object('error','unknown_item'); end if;

  select * into v_b from public.rl_hit('practice:speech', 120, 60);
  if v_b.limited then perform set_config('response.status','429',true);
    return jsonb_build_object('error','rate_limited','retryAfter', v_b.retry_after); end if;

  insert into speech_practice (user_id, item_id, practiced_at, count)
  values (v_uid, p_item_id, now(), 1)
  on conflict (user_id, item_id) do update set practiced_at = now(), count = speech_practice.count + 1;

  -- Keeps streak/daily-goal alive (credits no correctness — record_attempt rejects kind='speech').
  insert into daily_activity as da (user_id, day, attempts) values (v_uid, v_day, 0)
  on conflict (user_id, day) do update set attempts = da.attempts;   -- touch row so the day counts as active

  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.record_speech_practice(text) from public, anon;
grant  execute on function public.record_speech_practice(text) to authenticated;

-- ── bump_active_seconds(): foreground session-time (BUG-4 "Woche") ──────────────
create or replace function public.bump_active_seconds(p_seconds integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_b   record;
  v_day date := (now() at time zone 'utc')::date;
  v_sec integer := greatest(0, least(coalesce(p_seconds,0), 3600));   -- clamp a single flush to ≤1h
begin
  if v_uid is null then perform set_config('response.status','401',true);
    return jsonb_build_object('error','unauthorized'); end if;
  select * into v_b from public.rl_hit('activity:seconds', 240, 60);
  if v_b.limited then perform set_config('response.status','429',true);
    return jsonb_build_object('error','rate_limited','retryAfter', v_b.retry_after); end if;

  insert into daily_activity as da (user_id, day, active_seconds) values (v_uid, v_day, v_sec)
  on conflict (user_id, day) do update set active_seconds = coalesce(da.active_seconds,0) + v_sec;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.bump_active_seconds(integer) from public, anon;
grant  execute on function public.bump_active_seconds(integer) to authenticated;

-- ── trg_exam_points: award exam points on grade insert (mirrors trg_exam_result_daily) ──
create or replace function public.trg_exam_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_week text := to_char((new.graded_at at time zone 'utc'), 'IYYY"-W"IW');
  v_day  date := (new.graded_at at time zone 'utc')::date;
  v_pts  integer;
  v_goal_done boolean;
begin
  v_pts := round(60 * (new.gesamtpunkte / nullif(new.max_punkte,0)))   -- EXAM_MAX × ratio
         + case when new.bestanden then 20 else 0 end;                 -- EXAM_PASS_BONUS
  insert into points_events (user_id, kind, points, ref_id, week_key)
    values (new.user_id, 'exam', greatest(0, coalesce(v_pts,0)), new.id::text, v_week);

  select exists (select 1 from points_events where user_id = new.user_id and kind = 'daily_goal'
    and (created_at at time zone 'utc')::date = v_day) into v_goal_done;
  if not v_goal_done then
    insert into points_events (user_id, kind, points, ref_id, week_key)
      values (new.user_id, 'daily_goal', 20, new.id::text, v_week);
  end if;
  return new;
end $$;
drop trigger if exists exam_points on exam_results;
create trigger exam_points after insert on exam_results
  for each row execute function public.trg_exam_points();

-- ============================================================
--  Read models (views; security_invoker → own rows via underlying RLS)
-- ============================================================

-- ── v_readiness: per-module readiness for the calling user (0..100) ─────────────
--  strength_i = base × decay; base 1.0 first-try / 0.7 later / 0 never; decay exp(-age/18d) floor 0.4.
--  Mean over ALL B1 items in the module (unattempted = 0). Schreiben blends 0.6 practice + 0.4 exam.
create or replace view v_readiness with (security_invoker = on) as
with cat as (
  -- R2-1: über das PRÜFUNGSNIVEAU der/des aufrufenden Lernenden (nicht hart auf B1)
  select r.id, (case r.skill_code when 'shared' then 'konnektoren' else r.skill_code::text end) as module
  from redemittel r
  where r.level::text = coalesce((select level::text from profiles where id = auth.uid()), 'B1')
),
strengths as (
  select cat.module,
    case when ep.mastered_at is null then 0::numeric
         else (case when coalesce(ep.first_try_correct, false) then 1.0 else 0.7 end)
              * greatest(0.4, exp(- extract(epoch from (now() - coalesce(ep.last_correct_at, ep.mastered_at))) / 86400.0 / 18.0))
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

-- ── v_daily_status: goal-met + streak for the calling user ──────────────────────
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
select
  coalesce((select goal_met from goal where is_today), false) as goal_met_today,
  coalesce((select len from runs
    where last_day >= (now() at time zone 'utc')::date - 1
    order by last_day desc limit 1), 0)::int as streak;

-- ── v_weekly_leaderboard: class-gated (BUILT, hidden behind class_enabled) ───────
create or replace view v_weekly_leaderboard with (security_invoker = on) as
select e.class_id, pe.user_id, p.display_name as first_name, sum(pe.points)::int as points,
  rank() over (partition by e.class_id order by sum(pe.points) desc) as rank
from points_events pe
join class_enrollments e on e.student_id = pe.user_id and e.status = 'active'
left join profiles p on p.id = pe.user_id
where pe.week_key = to_char((now() at time zone 'utc'), 'IYYY"-W"IW')
group by e.class_id, pe.user_id, p.display_name;

-- ── snapshot_readiness(): daily cron (owner/service-role only) ───────────────────
--  Recompute per active user and persist for the "+Δ diese Woche" trend.
create or replace function public.snapshot_readiness()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer := 0; v_uid uuid; v_today date := (now() at time zone 'utc')::date;
  v_s numeric; v_p numeric; v_k numeric; v_overall numeric;
begin
  for v_uid in (select distinct user_id from exercise_progress
                union select distinct user_id from exam_results) loop
    -- per-module fractional readiness (mirrors v_readiness math, computed directly per user)
    with cat as (
      -- R2-1: über das Prüfungsniveau des jeweiligen Nutzers
      select r.id, (case r.skill_code when 'shared' then 'konnektoren' else r.skill_code::text end) as module
      from redemittel r
      where r.level::text = coalesce((select level::text from profiles where id = v_uid), 'B1')
    ),
    strengths as (
      select cat.module,
        case when ep.mastered_at is null then 0::numeric
             else (case when coalesce(ep.first_try_correct,false) then 1.0 else 0.7 end)
                  * greatest(0.4, exp(- extract(epoch from (now() - coalesce(ep.last_correct_at, ep.mastered_at))) / 86400.0 / 18.0))
        end as strength
      from cat left join exercise_progress ep on ep.item_id = cat.id and ep.user_id = v_uid
    ),
    pr as (select module, avg(strength) as frac from strengths group by module)
    select max(case when module='schreiben' then frac end),
           max(case when module='sprechen'  then frac end),
           max(case when module='konnektoren' then frac end)
      into v_s, v_p, v_k from pr;

    v_s := coalesce(v_s,0); v_p := coalesce(v_p,0); v_k := coalesce(v_k,0);
    -- schreiben exam blend
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
    v_overall := 0.5*v_s + 0.25*v_p + 0.25*v_k;   -- Schreiben weighted highest (graded core)

    insert into readiness_snapshots (user_id, captured_on, overall, schreiben, sprechen, konnektoren)
    values (v_uid, v_today, round(100*v_overall), round(100*v_s), round(100*v_p), round(100*v_k))
    on conflict (user_id, captured_on) do update set
      overall=excluded.overall, schreiben=excluded.schreiben, sprechen=excluded.sprechen, konnektoren=excluded.konnektoren;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.snapshot_readiness() from public, anon, authenticated;   -- owner/service-role only
