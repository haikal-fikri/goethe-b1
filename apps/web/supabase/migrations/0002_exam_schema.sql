-- ============================================================
--  Redemittel-Trainer — Prüfungsschema (Schreiben-Simulationen)
--  Goethe-B1-Schreiben: 4 Simulationen mit je 3 Aufgaben.
--  Public read; Schreibzugriff nur Service-Role. Idempotent.
-- ============================================================

create table if not exists exam_simulations (
  id          integer primary key,
  title_de    text not null,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists exam_tasks (
  id                  text primary key,          -- 's1-a1'
  simulation_id       integer not null references exam_simulations(id) on delete cascade,
  aufgabe             smallint not null check (aufgabe between 1 and 3),
  task_type           text not null,             -- 'Persönliche E-Mail' …
  title_de            text not null,
  prompt_de           text not null,
  bullet_points_de    text[] not null default '{}',
  min_words           smallint not null default 80,
  recommended_minutes smallint,
  sort_order          smallint not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists idx_exam_tasks_sim on exam_tasks(simulation_id);

-- RLS: public read ------------------------------------------
alter table exam_simulations enable row level security;
alter table exam_tasks       enable row level security;

do $$ begin
  create policy "public read exam_simulations" on exam_simulations for select using (true);
  create policy "public read exam_tasks"       on exam_tasks       for select using (true);
exception when duplicate_object then null; end $$;
