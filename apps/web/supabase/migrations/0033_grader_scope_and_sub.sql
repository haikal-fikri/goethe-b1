-- 0033 — Teacher-Lesezugriff klassen-scopen + Grade-Gate ans Abo binden (Security-Review-Fix)
--
-- Problem A (Read-Scope, Medium): die Teacher-SELECT-Policies der Review-Tabellen
-- gaten über app_teacher_can_read(student_id) — also STUDENT-scoped ("teilt der
-- Aufrufer IRGENDEINE aktive Klasse mit diesem Schüler?"). Ist ein Schüler in
-- Klasse A (Lehrkraft T1) UND Klasse B (Lehrkraft T2), kann T1 die Essays/Noten
-- des Schülers aus Klasse B lesen, obwohl T1 Klasse B nicht unterrichtet.
--
-- Problem B (Grade-Gate, Low): is_submission_grader/is_speaking_grader prüfen nur
-- is_class_grader (Rolle/Staffing), NICHT class_sub_active. Eine Lehrkraft mit
-- abgelaufenem Abo kann weiter benoten (die Read-Seite via app_teacher_can_read ist
-- bereits abo-gegated — die Write-Seite nicht).
--
-- Fix (beides in einem): is_submission_grader/is_speaking_grader zusätzlich an
-- class_sub_active binden und die 6 Review-Read-Policies auf DIESES per-Submission-
-- Gate umstellen (klassen-scoped statt student-scoped). is_class_grader schließt
-- bereits class_staff role='assistant' ein → die künftige TA-Rolle bekommt damit
-- automatisch korrekten per-Klassen-Zugriff, ohne Nacharbeit.
--
-- BEWUSST unverändert (kein Fix): exam_results / readiness_snapshots / profiles /
-- exam_result_feedback bleiben auf app_teacher_can_read (student-scoped) — das sind
-- Eigenübungs-/Dashboard-Zeilen OHNE zugehörige Klasse, ein per-Klassen-Scope ist
-- dort nicht anwendbar.

-- ── (A+B) Grader-Gates: is_class_grader UND class_sub_active ────────────────
create or replace function public.is_submission_grader(_submission uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from assignment_submissions s
    join assignments a on a.id = s.assignment_id
    where s.id = _submission
      and public.is_class_grader(a.class_id)
      and public.class_sub_active(a.class_id));
$$;
create or replace function public.is_speaking_grader(_submission uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from speaking_submissions s
    join speaking_assignments a on a.id = s.assignment_id
    where s.id = _submission
      and public.is_class_grader(a.class_id)
      and public.class_sub_active(a.class_id));
$$;
revoke all on function public.is_submission_grader(uuid), public.is_speaking_grader(uuid) from public, anon;
grant execute on function public.is_submission_grader(uuid), public.is_speaking_grader(uuid) to authenticated;

-- ── (A) Review-Read-Policies auf das per-Submission-Grader-Gate umstellen ───
-- Schreiben (Essay des Schülers)
drop policy if exists "asub teacher select" on assignment_submissions;
create policy "asub teacher select" on assignment_submissions for select
  using (public.is_submission_grader(id));

-- Schreiben (AI-Empfehlung)
drop policy if exists "asub_ai teacher read" on assignment_ai_recommendations;
create policy "asub_ai teacher read" on assignment_ai_recommendations for select
  using (public.is_submission_grader(submission_id));

-- Schreiben (Note)
drop policy if exists "agrade teacher read" on assignment_grades;
create policy "agrade teacher read" on assignment_grades for select
  using (public.is_submission_grader(submission_id));

-- Sprechen (Abgabe)
drop policy if exists "spk_sub teacher select" on speaking_submissions;
create policy "spk_sub teacher select" on speaking_submissions for select
  using (public.is_speaking_grader(id));

-- Sprechen (Note)
drop policy if exists "spk_grade teacher select" on speaking_grades;
create policy "spk_grade teacher select" on speaking_grades for select
  using (public.is_speaking_grader(submission_id));

-- Sprechen (AI-Empfehlung)
drop policy if exists "spk_ai teacher read" on speaking_ai_recommendations;
create policy "spk_ai teacher read" on speaking_ai_recommendations for select
  using (public.is_speaking_grader(submission_id));
