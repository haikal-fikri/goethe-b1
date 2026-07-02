-- ============================================================
--  0007 — In-DB-Ratenbegrenzung + der einzige Fortschritts-Schreibpfad (LIVE)
--  Fortschritts-Writes sind client-direkt (erreichen Vercel/Upstash nie) →
--  in der DB begrenzt. Direkter insert/update auf die drei Tabellen wird
--  entzogen; einziger Schreiber = record_attempt() (begrenzt + berechnet
--  correct serverseitig neu). Ledger: RLS default-deny + revoke all.
-- ============================================================

-- Ledger (pro Nutzer) — RLS ON ohne Policies (deny-all) + revoke all ---
create table if not exists app_rate_limits (
  user_id      uuid    not null references auth.users(id) on delete cascade,
  bucket       text    not null,
  window_start bigint  not null,          -- Epoch-Sekunde, auf Fenster gerundet
  count        integer not null default 0,
  primary key (user_id, bucket, window_start)
);
alter table app_rate_limits enable row level security;      -- KEINE Policies → deny-all
revoke all on app_rate_limits from anon, authenticated;
create index if not exists idx_app_rate_limits_gc on app_rate_limits(window_start);

-- Globaler Ledger (nutzerlos) — für den Groq-Budget-Breaker ------------
create table if not exists app_global_rate_limits (
  bucket       text    not null,
  window_start bigint  not null,
  count        integer not null default 0,
  primary key (bucket, window_start)
);
alter table app_global_rate_limits enable row level security;   -- KEINE Policies → deny-all
revoke all on app_global_rate_limits from anon, authenticated;
create index if not exists idx_app_global_rate_limits_gc on app_global_rate_limits(window_start);

-- Fixed-Window-Zähler pro Nutzer (definer-only) -----------------------
create or replace function public.rl_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns table (limited boolean, retry_after integer)
language plpgsql security definer set search_path = public as $$
declare
  v_now   bigint := floor(extract(epoch from now()))::bigint;
  v_start bigint := v_now - (v_now % p_window_seconds);
  v_count integer;
begin
  insert into app_rate_limits (user_id, bucket, window_start, count)
  values (auth.uid(), p_bucket, v_start, 1)
  on conflict (user_id, bucket, window_start) do update set count = app_rate_limits.count + 1
  returning count into v_count;
  if v_count > p_limit then return query select true, (v_start + p_window_seconds - v_now)::integer;
  else return query select false, 0; end if;
end $$;
revoke all on function public.rl_hit(text,integer,integer) from public, anon, authenticated;  -- definer-only

-- Globaler, Redis-unabhängiger Groq-Budget-Breaker (fail-closed) -------
-- Von der Grade-Route über die DATABASE_URL-Verbindung aufgerufen (Owner-Rolle).
create or replace function public.grade_budget_hit(p_limit integer default 5000, p_window_seconds integer default 86400)
returns table (limited boolean, retry_after integer)
language plpgsql security definer set search_path = public as $$
declare
  v_now   bigint := floor(extract(epoch from now()))::bigint;
  v_start bigint := v_now - (v_now % p_window_seconds);
  v_count integer;
begin
  insert into app_global_rate_limits (bucket, window_start, count)
  values ('grade:global', v_start, 1)
  on conflict (bucket, window_start) do update set count = app_global_rate_limits.count + 1
  returning count into v_count;
  if v_count > p_limit then return query select true, (v_start + p_window_seconds - v_now)::integer;
  else return query select false, 0; end if;
end $$;
revoke all on function public.grade_budget_hit(integer,integer) from public, anon, authenticated;  -- Owner/Service-Role-only

-- Der EINZIGE Schreiber von exercise_attempts/_progress/daily_activity --
create or replace function public.record_attempt(
  p_item_id text, p_lesson_id text, p_kind exercise_kind,
  p_submitted_tokens text[] default '{}', p_duration_ms integer default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_b   record;
  v_day date := (now() at time zone 'utc')::date;
  v_correct boolean;
  v_tokens  text[];
  v_cloze   text[];
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
    -- Exakter, geordneter Token-Abgleich mit dem Lösungsschlüssel.
    v_correct := (coalesce(p_submitted_tokens,'{}') = v_tokens);
  else
    -- Cloze: die {{…}}-Füllungen aus cloze_template extrahieren (geordnet, inkl. Satzzeichen).
    select array_agg(mm.match[1] order by mm.ord)
      into v_cloze
      from redemittel rr,
           lateral regexp_matches(rr.cloze_template, '\{\{([^}]+)\}\}', 'g') with ordinality as mm(match, ord)
     where rr.id = p_item_id;
    v_correct := (coalesce(p_submitted_tokens,'{}') = coalesce(v_cloze,'{}'));
  end if;

  insert into exercise_attempts (user_id,item_id,lesson_id,kind,correct,submitted_tokens,duration_ms)
  values (v_uid,p_item_id,p_lesson_id,p_kind,v_correct,coalesce(p_submitted_tokens,'{}'),p_duration_ms);

  insert into exercise_progress as ep (user_id,item_id,lesson_id,attempts,correct_count,last_correct,mastered_at,last_seen_at)
  values (v_uid,p_item_id,p_lesson_id,1,(v_correct)::int,v_correct, case when v_correct then now() end, now())
  on conflict (user_id,item_id) do update set
    attempts=ep.attempts+1, correct_count=ep.correct_count+(v_correct)::int,
    last_correct=v_correct, mastered_at=coalesce(ep.mastered_at, case when v_correct then now() end), last_seen_at=now();

  insert into daily_activity as da (user_id,day,attempts,correct_count)
  values (v_uid,v_day,1,(v_correct)::int)
  on conflict (user_id,day) do update set
    attempts=da.attempts+1, correct_count=da.correct_count+(v_correct)::int;

  return jsonb_build_object('ok',true,'correct',v_correct);
end $$;
revoke all on function public.record_attempt(text,text,exercise_kind,text[],integer) from public, anon;
grant  execute on function public.record_attempt(text,text,exercise_kind,text[],integer) to authenticated;

-- HARTE INVARIANTE: kein insert/update-Grant/-Policy auf den drei Fortschrittstabellen.
revoke insert, update on exercise_attempts, exercise_progress, daily_activity from authenticated, anon;

-- GC (täglich aus dem Purge-Cron): alte Ratenfenster entfernen (> 48 h).
--   delete from app_rate_limits        where window_start < floor(extract(epoch from now())) - 172800;
--   delete from app_global_rate_limits where window_start < floor(extract(epoch from now())) - 172800;
