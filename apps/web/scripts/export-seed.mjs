#!/usr/bin/env node
/**
 * DB-CANONICAL bootstrap export.
 *
 * The DB is the source of truth; this reads the live Postgres and writes a
 * frozen, idempotent `supabase/seed.sql` (+ `seed_exam.sql`) so a fresh clone
 * can recreate the corrected content from `migrations/* + seed`. Unlike the
 * retired JSON→seed generator, the upsert updates ALL columns on conflict
 * (the old one only updated 4, so level/notes/frame/examples edits silently
 * failed to propagate).
 *
 *   DATABASE_URL=... node scripts/export-seed.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(join(ROOT, ".env"), "utf8");
  const m = env.match(/^DATABASE_URL\s*=\s*["']?([^"'\n]+)/m);
  if (!m) throw new Error("DATABASE_URL not found");
  return m[1];
}

const sql = postgres(dbUrl(), { ssl: "require" });
const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) =>
  `array[${(a ?? []).map((x) => `'${String(x).replace(/'/g, "''")}'`).join(",")}]::text[]`;
const jsonb = (v) => `'${JSON.stringify(v ?? []).replace(/'/g, "''")}'::jsonb`;

function upsert(table, cols, row, conflict) {
  const vals = cols.map((c) => row[c.sql]).join(", ");
  const set = cols
    .filter((c) => c.name !== conflict)
    .map((c) => `${c.name}=excluded.${c.name}`)
    .join(", ");
  return `insert into ${table} (${cols.map((c) => c.name).join(", ")}) values (${vals}) on conflict (${conflict}) do update set ${set};`;
}

async function main() {
  const skills = await sql`select code, name_de, sort_order from skills order by sort_order, code`;
  const tasks = await sql`select code, skill_code, label_de, label_en, sort_order from tasks order by sort_order, code`;
  const functions = await sql`select code, name_de, name_en from functions order by code`;
  // parent rows must precede example children (self-FK) — id ordering keeps '<id>' before '<id>#exN'.
  const items = await sql`select * from redemittel order by skill_code, task_code, difficulty, id`;
  // 0011 i18n (guarded so export still works against a pre-0011 DB).
  const hasI18n = (await sql`select to_regclass('public.redemittel_translation') as t`)[0].t != null;
  const languages = hasI18n ? await sql`select code, name_native, name_de, rtl, enabled, sort_order from languages order by sort_order, code` : [];
  const translations = hasI18n ? await sql`select row_id, lang, translation, status, translator from redemittel_translation order by row_id, lang` : [];

  const out = [];
  out.push("-- AUTO-EXPORTED from the canonical DB by scripts/export-seed.mjs.");
  out.push("-- Bootstrap a fresh DB: psql -f migrations/0001..0004 then psql -f seed.sql");
  out.push("");
  for (const s of skills)
    out.push(upsert("skills", [{ name: "code", sql: "code" }, { name: "name_de", sql: "name_de" }, { name: "sort_order", sql: "sort_order" }],
      { code: q(s.code), name_de: q(s.name_de), sort_order: s.sort_order }, "code"));
  for (const t of tasks)
    out.push(upsert("tasks", [{ name: "code", sql: "code" }, { name: "skill_code", sql: "skill_code" }, { name: "label_de", sql: "label_de" }, { name: "label_en", sql: "label_en" }, { name: "sort_order", sql: "sort_order" }],
      { code: q(t.code), skill_code: q(t.skill_code), label_de: q(t.label_de), label_en: q(t.label_en), sort_order: t.sort_order }, "code"));
  for (const f of functions)
    out.push(upsert("functions", [{ name: "code", sql: "code" }, { name: "name_de", sql: "name_de" }, { name: "name_en", sql: "name_en" }],
      { code: q(f.code), name_de: q(f.name_de), name_en: q(f.name_en) }, "code"));
  // languages before redemittel_translation (FK); redemittel_translation emitted after redemittel rows.
  for (const l of languages)
    out.push(`insert into languages (code, name_native, name_de, rtl, enabled, sort_order) values (${q(l.code)}, ${q(l.name_native)}, ${q(l.name_de)}, ${l.rtl}, ${l.enabled}, ${l.sort_order}) on conflict (code) do update set name_native=excluded.name_native, name_de=excluded.name_de, rtl=excluded.rtl, enabled=excluded.enabled, sort_order=excluded.sort_order;`);

  const cols = [
    { name: "id", sql: "id" }, { name: "phrase_de", sql: "phrase_de" }, { name: "frame_de", sql: "frame_de" },
    { name: "translation_en", sql: "translation_en" }, { name: "level", sql: "level" }, { name: "skill_code", sql: "skill_code" },
    { name: "task_code", sql: "task_code" }, { name: "function_code", sql: "function_code" }, { name: "register_group", sql: "register_group" },
    { name: "notes", sql: "notes" }, { name: "cloze_template", sql: "cloze_template" }, { name: "tokens", sql: "tokens" },
    { name: "distractors", sql: "distractors" }, { name: "tags", sql: "tags" }, { name: "difficulty", sql: "difficulty" },
    { name: "examples", sql: "examples" }, { name: "parent_id", sql: "parent_id" },
  ];
  for (const it of items) {
    out.push(upsert("redemittel", cols, {
      id: q(it.id), phrase_de: q(it.phrase_de), frame_de: q(it.frame_de), translation_en: q(it.translation_en),
      level: q(it.level), skill_code: q(it.skill_code), task_code: q(it.task_code), function_code: q(it.function_code),
      register_group: q(it.register_group), notes: q(it.notes), cloze_template: q(it.cloze_template),
      tokens: arr(it.tokens), distractors: arr(it.distractors), tags: arr(it.tags), difficulty: it.difficulty,
      examples: jsonb(it.examples), parent_id: q(it.parent_id),
    }, "id"));
  }
  // redemittel_translation after all redemittel rows (FK row_id → redemittel.id).
  for (const t of translations)
    out.push(`insert into redemittel_translation (row_id, lang, translation, status, translator) values (${q(t.row_id)}, ${q(t.lang)}, ${q(t.translation)}, ${q(t.status)}, ${q(t.translator)}) on conflict (row_id, lang) do update set translation=excluded.translation, status=excluded.status, translator=excluded.translator, updated_at=now();`);
  writeFileSync(join(ROOT, "supabase", "seed.sql"), out.join("\n") + "\n", "utf8");

  // exam
  const sims = await sql`select id, title_de, sort_order from exam_simulations order by sort_order, id`;
  const etasks = await sql`select * from exam_tasks order by simulation_id, aufgabe`;
  const ex = ["-- AUTO-EXPORTED exam content from the canonical DB.", ""];
  for (const s of sims)
    ex.push(`insert into exam_simulations (id, title_de, sort_order) values (${s.id}, ${q(s.title_de)}, ${s.sort_order}) on conflict (id) do update set title_de=excluded.title_de, sort_order=excluded.sort_order;`);
  for (const t of etasks)
    ex.push(`insert into exam_tasks (id, simulation_id, aufgabe, task_type, title_de, prompt_de, bullet_points_de, min_words, recommended_minutes, sort_order, sample_answer_de) values (${q(t.id)}, ${t.simulation_id}, ${t.aufgabe}, ${q(t.task_type)}, ${q(t.title_de)}, ${q(t.prompt_de)}, ${arr(t.bullet_points_de)}, ${t.min_words}, ${t.recommended_minutes ?? "null"}, ${t.sort_order}, ${q(t.sample_answer_de)}) on conflict (id) do update set simulation_id=excluded.simulation_id, aufgabe=excluded.aufgabe, task_type=excluded.task_type, title_de=excluded.title_de, prompt_de=excluded.prompt_de, bullet_points_de=excluded.bullet_points_de, min_words=excluded.min_words, recommended_minutes=excluded.recommended_minutes, sort_order=excluded.sort_order, sample_answer_de=excluded.sample_answer_de;`);
  writeFileSync(join(ROOT, "supabase", "seed_exam.sql"), ex.join("\n") + "\n", "utf8");

  console.log(`exported ${items.length} redemittel, ${etasks.length} exam tasks → supabase/seed.sql, seed_exam.sql`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
