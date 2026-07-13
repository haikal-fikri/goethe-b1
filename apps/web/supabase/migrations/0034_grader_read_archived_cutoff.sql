-- 0034 — Review-Reads: Archiv-Cutoff wiederherstellen (Fix für 0033) (Security-Review-Fix)
--
-- 0033 hat die 6 Review-Read-Policies von app_teacher_can_read(student) auf das
-- per-Submission-Gate is_submission_grader/is_speaking_grader umgestellt. Dabei ging
-- EIN Bestandteil der alten Garantie verloren: app_teacher_can_read verlangte
-- `c.archived_at is null` (eine ARCHIVIERTE Klasse entzieht den Lesezugriff sofort,
-- in RLS — dokumentierte, nicht-optionale Datenschutz-Zusage, teacher-lms/06 §2 Pkt. 3,
-- Test T-14). is_class_grader → is_class_teacher prüft archived_at NICHT. Ohne Fix
-- könnte eine Lehrkraft/TA nach dem Archivieren weiter Essays/Noten/Transkripte lesen.
--
-- Fix: dedizierte READ-Helfer (Grader + aktives Abo + NICHT archiviert) und die 6
-- Read-Policies darauf umstellen. Die WRITE/Act-Gates is_submission_grader/
-- is_speaking_grader (Grader + Abo, OHNE archived-Check) bleiben unverändert — so
-- ändert sich das Benotungs-/Audio-Verhalten nicht (kein Eingriff in den
-- Term-Close-final-grade-Carve-out; archived_at ≠ is_class_locked).

-- ── Read-Helfer: Grader + aktives Abo + Klasse nicht archiviert ─────────────
create or replace function public.is_submission_reader(_submission uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from assignment_submissions s
    join assignments a on a.id = s.assignment_id
    join classes c on c.id = a.class_id
    where s.id = _submission
      and c.archived_at is null
      and public.is_class_grader(a.class_id)
      and public.class_sub_active(a.class_id));
$$;
create or replace function public.is_speaking_reader(_submission uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from speaking_submissions s
    join speaking_assignments a on a.id = s.assignment_id
    join classes c on c.id = a.class_id
    where s.id = _submission
      and c.archived_at is null
      and public.is_class_grader(a.class_id)
      and public.class_sub_active(a.class_id));
$$;
revoke all on function public.is_submission_reader(uuid), public.is_speaking_reader(uuid) from public, anon;
grant execute on function public.is_submission_reader(uuid), public.is_speaking_reader(uuid) to authenticated;

-- ── Review-Read-Policies auf die archived-bewussten Read-Helfer umstellen ───
drop policy if exists "asub teacher select" on assignment_submissions;
create policy "asub teacher select" on assignment_submissions for select
  using (public.is_submission_reader(id));

drop policy if exists "asub_ai teacher read" on assignment_ai_recommendations;
create policy "asub_ai teacher read" on assignment_ai_recommendations for select
  using (public.is_submission_reader(submission_id));

drop policy if exists "agrade teacher read" on assignment_grades;
create policy "agrade teacher read" on assignment_grades for select
  using (public.is_submission_reader(submission_id));

drop policy if exists "spk_sub teacher select" on speaking_submissions;
create policy "spk_sub teacher select" on speaking_submissions for select
  using (public.is_speaking_reader(id));

drop policy if exists "spk_grade teacher select" on speaking_grades;
create policy "spk_grade teacher select" on speaking_grades for select
  using (public.is_speaking_reader(submission_id));

drop policy if exists "spk_ai teacher read" on speaking_ai_recommendations;
create policy "spk_ai teacher read" on speaking_ai_recommendations for select
  using (public.is_speaking_reader(submission_id));
