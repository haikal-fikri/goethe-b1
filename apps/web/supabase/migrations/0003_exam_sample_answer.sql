-- ============================================================
--  Beispieltext / Musterlösung pro Aufgabe (optional). Idempotent.
-- ============================================================

alter table exam_tasks
  add column if not exists sample_answer_de text;
