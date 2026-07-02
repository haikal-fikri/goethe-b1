-- ============================================================
--  0009 — Sprechen (DEFERRED / schema-ready)
--  Klassen-/Lehrkraft-SaaS-only; MVP Teil 2 Monolog. On-device-Sprech-
--  ÜBUNG in der App speichert nichts → keine Tabellen. Einreichungen NUR
--  Service-Role (Client-gesetzter audio_key = Cross-Tenant-Voice-Leak);
--  Note NUR Service-Role; Schüler sieht Note erst, wenn released_at gesetzt ist.
-- ============================================================

do $$ begin create type speaking_status as enum ('recorded','scored','graded','purged','failed'); exception when duplicate_object then null; end $$;

create table if not exists speaking_assignments (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references classes(id) on delete cascade,
  teil         smallint not null check (teil in (1,2)),
  prompt_de    text not null,
  partner_mode text check (partner_mode in ('peer','ai_fallback')),  -- nur Teil 1
  due_at       timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_speaking_assignments_class on speaking_assignments(class_id);

create table if not exists speaking_submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references speaking_assignments(id) on delete cascade,
  student_id     uuid not null references auth.users(id)          on delete cascade,
  audio_key      text,                                             -- R2-Key; serverseitig; NULL nach Purge
  transcript     text,
  speechace      jsonb,
  duration_ms    integer check (duration_ms is null or duration_ms <= 300000),  -- ≤ 5:00
  status         speaking_status not null default 'recorded',
  audio_purge_at timestamptz not null default (now() + interval '7 days'),      -- Backstop; bei Note auf graded_at+24h gesetzt
  created_at     timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index if not exists idx_speaking_submissions_assign_student on speaking_submissions(assignment_id, student_id);
create index if not exists idx_speaking_submissions_purge on speaking_submissions(audio_purge_at) where audio_key is not null;

create table if not exists speaking_grades (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references speaking_submissions(id) on delete cascade,
  graded_by     uuid not null references auth.users(id),
  criteria      jsonb not null,                       -- {erfuellung,kohaerenz,wortschatz,strukturen,aussprache} Bänder A–E
  gesamt        numeric(4,1),
  bestanden     boolean,
  feedback_de   text,
  released_at   timestamptz,                          -- GATE: null = für Schüler nicht sichtbar
  graded_at     timestamptz not null default now(),   -- startet die 24h-Audio-Purge-Uhr
  created_at    timestamptz not null default now(),
  unique (submission_id)
);
create index if not exists idx_speaking_grades_submission on speaking_grades(submission_id);

create or replace function public.speaking_submission_owner(p_submission uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select student_id from speaking_submissions where id = p_submission; $$;
revoke all on function public.speaking_submission_owner(uuid) from public, anon;
grant execute on function public.speaking_submission_owner(uuid) to authenticated;

alter table speaking_assignments enable row level security;
alter table speaking_submissions enable row level security;
alter table speaking_grades      enable row level security;

do $$ begin create policy "spk_assign read" on speaking_assignments for select using (public.is_class_teacher(class_id) or public.is_enrolled(class_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "spk_assign teacher insert" on speaking_assignments for insert with check (public.is_class_teacher(class_id) and public.has_active_teacher_sub((select auth.uid()))); exception when duplicate_object then null; end $$;
do $$ begin create policy "spk_assign teacher update" on speaking_assignments for update using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy "spk_assign teacher delete" on speaking_assignments for delete using (public.is_class_teacher(class_id)); exception when duplicate_object then null; end $$;

-- submissions: read own / teacher-read shared-class. KEIN Client-INSERT/UPDATE (Erstellung + Scoring = Service-Role).
do $$ begin create policy "spk_sub student select" on speaking_submissions for select using (student_id = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "spk_sub teacher select" on speaking_submissions for select using (public.app_teacher_can_read(student_id)); exception when duplicate_object then null; end $$;

-- grades: Schüler liest eigene NUR wenn released; Lehrkraft liest shared-class. KEIN Client-Write (nur Service-Role).
do $$ begin create policy "spk_grade student select" on speaking_grades for select
  using (released_at is not null and public.speaking_submission_owner(submission_id) = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "spk_grade teacher select" on speaking_grades for select
  using (public.app_teacher_can_read(public.speaking_submission_owner(submission_id))); exception when duplicate_object then null; end $$;
