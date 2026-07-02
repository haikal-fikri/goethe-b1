-- ============================================================
--  0006 — Übungsfortschritt + Prüfungsergebnisse + Entwürfe (LIVE)
--  Fortschrittstabellen: select/delete-own; KEIN insert/update-Policy —
--  einziger Schreiber ist record_attempt() (0007). exam_results: nur
--  Service-Role schreibt (keine Client-Schreibpolicy). exam_drafts: own CRUD.
-- ============================================================

do $$ begin
  create type exercise_kind as enum ('wordbank','cloze','speech');
exception when duplicate_object then null; end $$;

create table if not exists exercise_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  item_id          text not null references redemittel(id) on delete cascade,   -- RedemittelItem.id
  lesson_id        text not null,                                               -- makeLessonId(skill,task,function)
  kind             exercise_kind not null,                                      -- 'wordbank' | 'cloze' (nie 'speech')
  correct          boolean not null,                                            -- serverseitig neu berechnet in record_attempt()
  submitted_tokens text[] not null default '{}',
  duration_ms      integer check (duration_ms is null or duration_ms between 0 and 3600000),
  created_at       timestamptz not null default now()
);
create index if not exists idx_exercise_attempts_user      on exercise_attempts(user_id, created_at desc);
create index if not exists idx_exercise_attempts_user_item on exercise_attempts(user_id, item_id);

create table if not exists exercise_progress (
  user_id       uuid not null references auth.users(id) on delete cascade,
  item_id       text not null references redemittel(id) on delete cascade,
  lesson_id     text not null,
  attempts      integer not null default 0,
  correct_count integer not null default 0,
  last_correct  boolean not null default false,
  mastered_at   timestamptz,
  last_seen_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index if not exists idx_exercise_progress_user_lesson on exercise_progress(user_id, lesson_id);

create table if not exists daily_activity (
  user_id        uuid not null references auth.users(id) on delete cascade,
  day            date not null,                 -- UTC-Tag
  attempts       integer not null default 0,
  correct_count  integer not null default 0,
  exams_graded   integer not null default 0,    -- vom exam_results-Trigger erhöht (Service-Role)
  active_seconds integer,
  primary key (user_id, day)
);

alter table exercise_attempts enable row level security;
alter table exercise_progress enable row level security;
alter table daily_activity    enable row level security;

do $$ begin create policy "attempts select own" on exercise_attempts for select using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "attempts delete own" on exercise_attempts for delete using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "progress select own" on exercise_progress for select using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "progress delete own" on exercise_progress for delete using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "daily select own"    on daily_activity    for select using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "daily delete own"    on daily_activity    for delete using (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
-- KEIN insert/update-Policy auf den drei Tabellen → Clients schreiben nicht direkt.
-- record_attempt() (0007) ist der einzige Schreiber.

-- exam_results: persistierte KI-Bewertungen (NUR Service-Role schreibt) --
-- Bildet 1:1 auf ExamResult/ExamGrade/ExaminerResult ab. Eine Zeile pro bewerteter Aufgabe.
create table if not exists exam_results (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  simulation_id integer references exam_simulations(id) on delete set null,  -- ExamTask.simulation
  task_id       text    references exam_tasks(id)       on delete set null,  -- ExamTask.id ('s1-a1')
  aufgabe       smallint not null check (aufgabe between 1 and 3),
  gesamtpunkte  numeric(4,1) not null,      -- reconciled.gesamtpunkte (round1)
  max_punkte    numeric(4,1) not null,      -- reconciled.maxPunkte (40 Teil1/2, 20 Teil3)
  bestanden     boolean      not null,      -- reconciled.bestanden (>= 0.6 * maxPunkte)
  third_used    boolean      not null default false,
  result        jsonb        not null,      -- volles ExamResult { reconciled, examiners[], thirdUsed }
  answer_text   text,                       -- eigener Entwurf; nullable (DSAR behält den Score)
  word_count    smallint     not null default 0,
  model         text,                       -- z.B. 'openai/gpt-oss-120b'
  graded_at     timestamptz  not null default now(),
  created_at    timestamptz  not null default now()
);
create index if not exists idx_exam_results_user      on exam_results(user_id, created_at desc);
create index if not exists idx_exam_results_user_task on exam_results(user_id, task_id);

alter table exam_results enable row level security;
do $$ begin
  create policy "exam_results select own" on exam_results for select using (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
-- KEIN insert/update/delete-Policy → nur die Service-Role-Grade-Route schreibt.

-- Streak bei jeder bewerteten Prüfung erhöhen (Service-Role-Insert löst das aus).
create or replace function public.trg_exam_result_daily() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into daily_activity (user_id, day, exams_graded)
  values (new.user_id, (new.graded_at at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set exams_graded = daily_activity.exams_graded + 1;
  return new;
end $$;
drop trigger if exists exam_result_daily on exam_results;
create trigger exam_result_daily after insert on exam_results
  for each row execute function public.trg_exam_result_daily();

-- exam_drafts: Entwurf pro Aufgabe (client-direkt, RLS own) --
create table if not exists exam_drafts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    text not null references exam_tasks(id) on delete cascade,
  text       text not null default '' check (char_length(text) <= 6000),  -- Guardrail; Wortlimits 200/100 app-seitig
  word_count smallint not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, task_id)
);
create index if not exists idx_exam_drafts_user on exam_drafts(user_id);
drop trigger if exists trg_exam_drafts_updated on exam_drafts;
create trigger trg_exam_drafts_updated before update on exam_drafts for each row execute function public.set_updated_at();

alter table exam_drafts enable row level security;
do $$ begin create policy "drafts all own" on exam_drafts for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid())); exception when duplicate_object then null; end $$;
