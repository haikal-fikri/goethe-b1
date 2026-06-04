-- ============================================================
--  Redemittel-Trainer — Content-Schema (nur Inhalte, keine Nutzer)
--  Alle Tabellen sind public read; Schreibzugriff nur Service-Role.
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- Enums ------------------------------------------------------
do $$ begin
  create type cefr_level as enum ('B1','B2','C1','C2');
exception when duplicate_object then null; end $$;

do $$ begin
  create type skill_scope as enum ('schreiben','sprechen','shared');
exception when duplicate_object then null; end $$;

-- Lookups ----------------------------------------------------
create table if not exists skills (
  code        skill_scope primary key,
  name_de     text not null,
  sort_order  smallint not null default 0
);

create table if not exists tasks (
  code        text primary key,            -- 'schreiben_a2'
  skill_code  skill_scope not null references skills(code),
  label_de    text not null,
  label_en    text not null,
  sort_order  smallint not null default 0
);

create table if not exists functions (
  code        text primary key,            -- 'meinung_aeussern'
  name_de     text not null,
  name_en     text not null
);

-- Kerninhalt -------------------------------------------------
create table if not exists redemittel (
  id              text primary key,         -- stabile Hash-ID aus dem Build
  phrase_de       text not null,
  frame_de        text,
  translation_en  text not null,
  level           cefr_level not null,
  skill_code      skill_scope not null references skills(code),
  task_code       text not null references tasks(code),
  function_code   text not null references functions(code),
  register_group  text,
  notes           text,
  cloze_template  text,
  audio_url       text,
  tokens          text[] not null,
  distractors     text[] not null default '{}',
  tags            text[] not null default '{}',
  difficulty      smallint not null default 1,
  search_norm     text generated always as (lower(phrase_de)) stored,
  created_at      timestamptz not null default now()
);

create index if not exists idx_redemittel_function on redemittel(function_code);
create index if not exists idx_redemittel_task     on redemittel(task_code);
create index if not exists idx_redemittel_level    on redemittel(level);
create index if not exists idx_redemittel_task_lvl on redemittel(task_code, level);
create index if not exists idx_redemittel_trgm     on redemittel using gin (search_norm gin_trgm_ops);

-- Denormalisierte Ansicht im App-Item-Format ----------------
create or replace view redemittel_item as
select
  r.id,
  r.phrase_de            as phrase,
  r.frame_de             as frame,
  r.translation_en       as translation,
  r.level,
  r.skill_code           as skill,
  jsonb_build_object('code', t.code, 'labelDe', t.label_de, 'labelEn', t.label_en) as task,
  jsonb_build_object('code', f.code, 'nameDe', f.name_de, 'nameEn', f.name_en)     as function,
  r.register_group       as "registerGroup",
  r.tokens,
  r.distractors,
  r.cloze_template       as "clozeTemplate",
  r.notes,
  r.tags,
  r.difficulty
from redemittel r
join tasks t      on t.code = r.task_code
join functions f  on f.code = r.function_code;

-- RLS: public read ------------------------------------------
alter table skills      enable row level security;
alter table tasks       enable row level security;
alter table functions   enable row level security;
alter table redemittel  enable row level security;

do $$ begin
  create policy "public read skills"     on skills     for select using (true);
  create policy "public read tasks"      on tasks      for select using (true);
  create policy "public read functions"  on functions  for select using (true);
  create policy "public read redemittel" on redemittel for select using (true);
exception when duplicate_object then null; end $$;
