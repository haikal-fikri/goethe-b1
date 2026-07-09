-- ============================================================
--  0020 — Writing assignments (corpus OR custom, D4) + teacher-review grading.
--  AI recommends (teacher-only table) → teacher accepts/edits → releases (gate).
--  Client writing is route-only (red-team fix). Canonical: teacher-lms/02 §5.
--  Depends on: 0008 (assignments/assignment_submissions), 0016 (is_class_locked/app_teacher_can_read), 0019 (notify).
-- ============================================================

set check_function_bodies = off;

-- ── 5.1 Custom-prompt columns on assignments (§5.1) ────────────────────────
alter table assignments
  add column if not exists prompt_de           text,
  add column if not exists bullet_points_de    text[]   not null default '{}',   -- Leitpunkte (custom source only)
  add column if not exists min_words           smallint check (min_words is null or min_words between 20 and 2000),
  add column if not exists recommended_minutes smallint,
  add column if not exists instructions_de     text;
comment on column assignments.prompt_de is 'Custom Aufgabe text (kind=writing, custom source). NULL when the assignment references a corpus exam_task via task_id.';

-- A writing assignment has EXACTLY ONE prompt source: corpus exam_task (task_id) XOR custom (prompt_de).
alter table assignments drop constraint if exists assignments_writing_source_ck;
alter table assignments add constraint assignments_writing_source_ck
  check (kind <> 'writing' or ((task_id is not null) <> (prompt_de is not null)));

-- Term-lock the assignment-creation path (D13, §1.6): a locked class accepts no new
-- assignments. Grade/feedback routes deliberately omit the lock (final-grade carve-out).
drop policy if exists "assign teacher insert" on assignments;
do $$ begin create policy "assign teacher insert" on assignments for insert
  with check (public.is_class_teacher(class_id) and not public.is_class_locked(class_id)); exception when duplicate_object then null; end $$;

-- ── 5.2 Answer columns + make writing route-only + sub-gate the teacher read (§5.2) ─
alter table assignment_submissions
  add column if not exists answer_text text check (answer_text is null or char_length(answer_text) <= 8000),
  add column if not exists word_count  smallint not null default 0;

-- (a) ROUTE-ONLY writing (red-team fix). The 0008 client-direct insert/update let a
--     student set answer_text/status themselves — skipping the AI grade or editing a
--     graded answer. Drop them; the submit route (service-role) is the sole writer.
drop policy if exists "asub student insert" on assignment_submissions;
drop policy if exists "asub student update" on assignment_submissions;
revoke insert, update on assignment_submissions from authenticated, anon;   -- read-own ("asub student select") stays

-- (b) SUB-GATE the teacher read (red-team fix). 0008's "asub teacher select" used
--     class-ownership only, so a revoked-sub teacher kept reading answers. Route it
--     through the canonical gate (role + active shared class + active sub).
drop policy if exists "asub teacher select" on assignment_submissions;
do $$ begin create policy "asub teacher select" on assignment_submissions for select
  using (public.app_teacher_can_read(student_id)); exception when duplicate_object then null; end $$;

-- (c) Reconcile trg_asub_guard. The 0008 guard raised 'cannot_set_graded' whenever a
--     JWT-role GUC was present — which ALSO blocks the legitimate service-role grade
--     write (PostgREST sets request.jwt.claim.role='service_role'). Now that client
--     insert/update is fully revoked above, that defensive block is redundant AND
--     harmful. Keep ONLY the exam_result-ownership check.
create or replace function public.trg_asub_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.exam_result_id is not null
     and not exists (select 1 from exam_results r where r.id = new.exam_result_id and r.user_id = new.student_id)
  then raise exception 'exam_result_not_owned' using errcode='42501'; end if;
  return new;
end $$;

-- ── 5.3 assignment_ai_recommendations — teacher-only AI draft (§5.3) ────────
create table if not exists assignment_ai_recommendations (
  submission_id uuid primary key references assignment_submissions(id) on delete cascade,
  recommended   jsonb not null,        -- @repo/core ExamGrade { criteria[4], gesamtpunkte, maxPunkte, bestanden, summaryDe, korrekturen }
  model         text,                  -- e.g. 'openai/gpt-oss-120b'
  created_at    timestamptz not null default now()
);
-- Resolve teacher/owner from a submission id.
create or replace function public.submission_owner(_submission uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select student_id from assignment_submissions where id = _submission; $$;
create or replace function public.is_submission_teacher(_submission uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from assignment_submissions s
    join assignments a on a.id = s.assignment_id join classes c on c.id = a.class_id
    where s.id = _submission and c.teacher_id = auth.uid());
$$;
revoke all on function public.submission_owner(uuid), public.is_submission_teacher(uuid) from public, anon;
grant execute on function public.submission_owner(uuid), public.is_submission_teacher(uuid) to authenticated;

alter table assignment_ai_recommendations enable row level security;
-- TEACHER reads (own class + active sub) only. NO student policy → students never
-- read the AI draft. Service-role writes.
do $$ begin create policy "asub_ai teacher read" on assignment_ai_recommendations for select
  using (public.app_teacher_can_read(public.submission_owner(submission_id))); exception when duplicate_object then null; end $$;

-- ── 5.4 assignment_grades — teacher's final, release-gated (§5.4) ───────────
create table if not exists assignment_grades (
  submission_id     uuid primary key references assignment_submissions(id) on delete cascade,
  final             jsonb   not null,        -- teacher-accepted ExamGrade + inlineKorrekturen (D14, points server-recomputed)
  gesamtpunkte      numeric(4,1) not null,
  max_punkte        numeric(4,1) not null,
  bestanden         boolean not null,
  teacher_remark_de text check (teacher_remark_de is null or char_length(teacher_remark_de) <= 4000),
  graded_by         uuid not null references auth.users(id),
  graded_at         timestamptz not null default now(),
  released_at       timestamptz,             -- GATE: null = invisible to student
  created_at        timestamptz not null default now()
);
alter table assignment_grades enable row level security;
-- Student reads own grade ONLY when released. Teacher reads own class. Service-role writes.
do $$ begin create policy "agrade student read" on assignment_grades for select
  using (released_at is not null and public.submission_owner(submission_id) = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "agrade teacher read" on assignment_grades for select
  using (public.app_teacher_can_read(public.submission_owner(submission_id))); exception when duplicate_object then null; end $$;
-- NO client write. The grade route (service-role) writes final + sets released_at;
-- also sets assignment_submissions.status='graded'. No ai_recommended column → the
-- released row is teacher-final only.

-- ── 5.5 New-assignment notification (SECURITY DEFINER triggers, §5.5) ───────
-- Assignment creation is client-direct (RLS insert) and notify() is revoked from
-- authenticated → a plain insert can't fan out. A definer AFTER INSERT trigger can.
create or replace function public.trg_assignment_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  for s in select student_id from class_enrollments where class_id = new.class_id and status = 'active' loop
    perform public.notify(s.student_id, 'assignment_new', 'Neue Aufgabe',
      coalesce(new.title, 'Neue Klassenaufgabe'),
      jsonb_build_object('classId', new.class_id, 'assignmentId', new.id, 'kind', new.kind));
  end loop;
  return new;
end $$;
drop trigger if exists assignment_notify on assignments;
create trigger assignment_notify after insert on assignments
  for each row execute function public.trg_assignment_notify();

-- Speaking assignments (speaking_assignments, 0009) get the same treatment.
create or replace function public.trg_speaking_assignment_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  for s in select student_id from class_enrollments where class_id = new.class_id and status = 'active' loop
    perform public.notify(s.student_id, 'assignment_new', 'Neue Sprechaufgabe', 'Teil ' || new.teil,
      jsonb_build_object('classId', new.class_id, 'speakingAssignmentId', new.id, 'teil', new.teil));
  end loop;
  return new;
end $$;
drop trigger if exists speaking_assignment_notify on speaking_assignments;
create trigger speaking_assignment_notify after insert on speaking_assignments
  for each row execute function public.trg_speaking_assignment_notify();

notify pgrst, 'reload schema';
