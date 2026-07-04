-- ============================================================
--  0011 — Redemittel i18n (translations TABLE) + examples-as-child-rows (min-6)
--  Additive on 0001/0004/0005. Content tables are EXTENDED (parent_id) but never
--  destroyed. Same invariants as every content table: public read, service-role
--  write only. STRUCTURAL ONLY — the start_set MIN_QUESTIONS padding + the
--  gamification logic ship in 0012 (after redemittel_practice exists here).
--  Web-app-safe: redemittel_item keeps its exact column contract.
--  See db/04-i18n-translations.md + 13 §11.
-- ============================================================

-- ── languages offered as Muttersprache ───────────────────────────────
create table if not exists languages (
  code        text primary key,                 -- ISO-639-1 / BCP-47: 'en','id',…
  name_native text not null,                     -- 'English','Bahasa Indonesia'
  name_de     text not null,                     -- 'Englisch','Indonesisch' (Settings-Label)
  rtl         boolean not null default false,    -- future-proofs Arabic/Farsi
  enabled     boolean not null default false,    -- only enabled langs appear in Settings 10
  sort_order  smallint not null default 100
);
alter table languages enable row level security;
do $$ begin create policy "languages public read" on languages for select using (true); exception when duplicate_object then null; end $$;

-- ── one row per (redemittel row, language). "row" = canonical Wendung OR example child.
--    Add a language = INSERT rows, never ALTER. ─────────────────────────────────────
create table if not exists redemittel_translation (
  row_id      text not null references redemittel(id) on delete cascade,   -- ANY redemittel row
  lang        text not null references languages(code) on delete cascade,
  translation text not null,                     -- translation of that row's phrase_de
  status      text not null default 'reviewed' check (status in ('draft','reviewed')),
  translator  text,
  updated_at  timestamptz not null default now(),
  primary key (row_id, lang)
);
create index if not exists idx_redtrans_lang on redemittel_translation (lang);
alter table redemittel_translation enable row level security;
do $$ begin create policy "redtrans public read" on redemittel_translation for select using (true); exception when duplicate_object then null; end $$;

-- Public read like every content table; writes via service role only. The bootstrap
-- default privileges grant authenticated ALL → grant SELECT, then revoke writes so
-- forge attempts throw 42501 (mirrors the 0010 scored-table pattern).
grant select on languages, redemittel_translation to anon, authenticated;
revoke insert, update, delete on languages, redemittel_translation from authenticated, anon;

-- ── examples become CHILD ROWS of redemittel (parent_id) ─────────────
--  parent_id IS NULL  → canonical Wendung (the ~414 catalog; Lernen/readiness/Gelernt).
--  parent_id NOT NULL → an EXAMPLE of that Wendung (practice-padding + feedback);
--                       inherits skill/task/function/level. Practiceable once it has
--                       tokens (non-empty) or a cloze_template; else feedback-only.
alter table redemittel add column if not exists parent_id text references redemittel(id) on delete cascade;
create index if not exists idx_redemittel_parent on redemittel (parent_id);

-- ── seed languages: en (enabled) + id (disabled until coverage clears the bar) ──────
insert into languages (code, name_native, name_de, enabled, sort_order) values
  ('en','English','Englisch', true, 1),
  ('id','Bahasa Indonesia','Indonesisch', false, 2)
on conflict (code) do nothing;

-- ── backfill phrase translations: translation_en → redemittel_translation(en) ───────
insert into redemittel_translation (row_id, lang, translation, status)
select id, 'en', translation_en, 'reviewed' from redemittel where parent_id is null
on conflict (row_id, lang) do nothing;

-- ── migrate examples jsonb → child rows (idempotent, guarded) ───────────────────────
--  Each examples[] entry of a canonical Wendung becomes a child redemittel row:
--    id='<parent>#ex<n>', parent_id=parent, phrase_de=entry.de,
--    translation_en=coalesce(entry.en, entry.de), skill/task/function/level inherited,
--    tokens='{}' (NOT NULL → empty array = NON-PRACTICEABLE feedback-only marker until
--    the owner's research step authors real tokens/cloze), cloze_template=null.
insert into redemittel (id, parent_id, phrase_de, translation_en, level,
                        skill_code, task_code, function_code, tokens, distractors, difficulty)
select p.id || '#ex' || ex.ord::text,
       p.id,
       ex.entry->>'de',
       coalesce(nullif(ex.entry->>'en',''), ex.entry->>'de'),
       p.level, p.skill_code, p.task_code, p.function_code,
       '{}'::text[], '{}'::text[], p.difficulty
from redemittel p
cross join lateral jsonb_array_elements(p.examples) with ordinality as ex(entry, ord)
where p.parent_id is null
  and jsonb_typeof(p.examples) = 'array'
  and coalesce(ex.entry->>'de','') <> ''
on conflict (id) do nothing;

-- child English translation rows (from examples[].en, falling back to the German)
insert into redemittel_translation (row_id, lang, translation, status)
select c.id, 'en', c.translation_en, 'reviewed'
from redemittel c
where c.parent_id is not null
on conflict (row_id, lang) do nothing;

-- ============================================================
--  Views (recreate; preserve every column + security_invoker)
-- ============================================================

-- ── redemittel_item (CANONICAL) — exact 0004 column contract + `where parent_id is
--    null`, with `examples` now AGGREGATED from child rows (back-compat: still
--    [{de, en, …}] so the web app is unchanged; the extra row_id key is ignored by
--    web, consumed by mobile for the translation overlay). Falls back to the mirror
--    jsonb when a Wendung has no migrated children. ────────────────────────────────
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
  coalesce(
    (select jsonb_agg(jsonb_build_object(
              'de', ch.phrase_de,
              'en', coalesce(cht.translation, ch.translation_en),
              'row_id', ch.id
            ) order by ch.id)
     from redemittel ch
     left join redemittel_translation cht on cht.row_id = ch.id and cht.lang = 'en'
     where ch.parent_id = r.id),
    r.examples
  ) as examples
from redemittel r
join tasks t      on t.code = r.task_code
join functions f  on f.code = r.function_code
where r.parent_id is null;

alter view redemittel_item set (security_invoker = on);
grant select on redemittel_item to anon, authenticated;

-- ── redemittel_practice — the pool start_set draws from: canonical rows + PRACTICEABLE
--    example children (tokens non-empty OR a cloze_template). Feedback-only children
--    (tokens='{}' AND cloze_template IS NULL) are excluded until authored. ───────────
create or replace view redemittel_practice as
select r.id, r.parent_id, r.skill_code, r.task_code, r.function_code, r.level
from redemittel r
where r.parent_id is null
   or cardinality(r.tokens) > 0
   or r.cloze_template is not null;

alter view redemittel_practice set (security_invoker = on);
grant select on redemittel_practice to anon, authenticated;

-- ── v_translation_coverage — reviewed translations of canonical rows per language vs
--    the canonical total; drives the ~≥95% enable gate for a language. ──────────────
create or replace view v_translation_coverage as
select l.code, l.name_de, l.enabled,
  count(t.row_id) filter (where t.status = 'reviewed') as reviewed,
  (select count(*) from redemittel where parent_id is null) as canonical
from languages l
left join redemittel_translation t
  on t.lang = l.code
  and t.row_id in (select id from redemittel where parent_id is null)
group by l.code, l.name_de, l.enabled;

alter view v_translation_coverage set (security_invoker = on);
grant select on v_translation_coverage to anon, authenticated;

-- Keep redemittel.examples jsonb + translation_en as a web back-compat MIRROR
-- (this migration reads FROM them; rows are now the source of truth). Deprecate later.
