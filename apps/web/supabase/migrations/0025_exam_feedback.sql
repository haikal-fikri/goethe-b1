-- ============================================================
--  0025 — Teacher feedback on built-in simulations. D3 gives the teacher the READ
--  of a student's built-in-sim essay (exam_results dashboard); 0025 adds the release-
--  gated FEEDBACK remark on it (reuses the assignment_grades release idiom). The essay
--  stays student-authored, teacher-read-only. Canonical: teacher-lms/02 §15.
--  Depends on: 0006 (exam_results), 0016 (app_teacher_can_read), 0005 (set_updated_at).
-- ============================================================

set check_function_bodies = off;

create table if not exists exam_result_feedback (
  exam_result_id uuid primary key references exam_results(id) on delete cascade,
  teacher_id     uuid not null references auth.users(id) on delete cascade,
  feedback_de    text not null check (char_length(feedback_de) <= 4000),
  released_at    timestamptz,                       -- GATE: null = not visible to the student
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_exam_result_feedback_teacher on exam_result_feedback(teacher_id);
drop trigger if exists trg_erf_updated on exam_result_feedback;
create trigger trg_erf_updated before update on exam_result_feedback for each row execute function public.set_updated_at();

create or replace function public.exam_result_owner(_result uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from exam_results where id = _result; $$;
revoke all on function public.exam_result_owner(uuid) from public, anon;
grant execute on function public.exam_result_owner(uuid) to authenticated;

alter table exam_result_feedback enable row level security;
-- Student reads feedback on their OWN result, only when released. Teacher reads within
-- dashboard scope. Admin reads. NO client write (feedback route service-role upserts).
do $$ begin create policy "erf student read"  on exam_result_feedback for select
  using (released_at is not null and public.exam_result_owner(exam_result_id) = (select auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "erf teacher read"  on exam_result_feedback for select
  using (public.app_teacher_can_read(public.exam_result_owner(exam_result_id))); exception when duplicate_object then null; end $$;
do $$ begin create policy "erf admin read"    on exam_result_feedback for select using (public.is_admin()); exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
