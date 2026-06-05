-- ============================================================
--  0004 — DB-canonical groundwork + example sentences
--  - `redemittel.id` is now a STABLE SURROGATE key: it is never
--    recomputed from content. Editing a phrase is an in-place UPDATE,
--    not an insert of a new hash-id row.
--  - Adds `examples` (1–2 contextual example sentences per entry) for
--    the pedagogy "quick wins" and exposes it in the app view.
-- ============================================================

-- Example sentences: jsonb array of {de, en?} objects, e.g.
--   [{"de":"Ich bin nicht überzeugt davon, dass …","en":"I'm not convinced that …"}]
alter table redemittel
  add column if not exists examples jsonb not null default '[]'::jsonb;

comment on column redemittel.id is
  'Stable surrogate primary key. Never regenerate from content; edit rows in place.';
comment on column redemittel.examples is
  'jsonb array of {de, en?} example sentences shown in feedback / reference.';

-- Re-create the app view to expose `examples` (appended at the end).
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
  r.difficulty,
  r.examples
from redemittel r
join tasks t      on t.code = r.task_code
join functions f  on f.code = r.function_code;
