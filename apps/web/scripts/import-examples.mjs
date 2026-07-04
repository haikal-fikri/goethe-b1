#!/usr/bin/env node
/**
 * Expert EXAMPLE-CHILD import (service-role / DB-direct, idempotent).
 *
 * Upserts example child redemittel rows on `id` (+ optional translation rows). A child
 * inherits skill/task/function/level/difficulty from its parent Wendung. Supplying real
 * `tokens` (word-bank) or a `cloze_template` makes the example PRACTICEABLE (it then joins
 * start_set's MIN_QUESTIONS=6 pool via redemittel_practice); omit them to keep it
 * feedback-only. This is the owner's post-0011 content step.
 *
 * Input: JSON array of
 *   { id, parent_id, phrase_de, translation_en?, tokens?, cloze_template?, distractors?,
 *     translations?: [{ lang, translation, status? }] }
 *
 *   DATABASE_URL=... node scripts/import-examples.mjs examples.json
 */
import { readFileSync } from "node:fs";
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
function readInput() {
  const file = process.argv[2];
  const raw = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8");
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error("Input must be a JSON array of example child rows.");
  return rows;
}

const sql = postgres(dbUrl(), { ssl: "require" });

async function main() {
  const rows = readInput();
  let ok = 0, skipped = 0;
  for (const r of rows) {
    if (!r.id || !r.parent_id || !r.phrase_de) { skipped++; continue; }
    const [parent] = await sql`select skill_code, task_code, function_code, level, difficulty from redemittel where id = ${r.parent_id}`;
    if (!parent) { console.warn(`skip ${r.id}: parent ${r.parent_id} not found`); skipped++; continue; }
    await sql`
      insert into redemittel (id, parent_id, phrase_de, translation_en, level, skill_code, task_code, function_code, tokens, cloze_template, distractors, difficulty)
      values (${r.id}, ${r.parent_id}, ${r.phrase_de}, ${r.translation_en ?? r.phrase_de},
              ${parent.level}, ${parent.skill_code}, ${parent.task_code}, ${parent.function_code},
              ${r.tokens ?? []}::text[], ${r.cloze_template ?? null}, ${r.distractors ?? []}::text[], ${parent.difficulty})
      on conflict (id) do update
        set phrase_de = excluded.phrase_de, translation_en = excluded.translation_en,
            tokens = excluded.tokens, cloze_template = excluded.cloze_template, distractors = excluded.distractors
    `;
    for (const t of r.translations ?? []) {
      if (!t.lang || t.translation == null) continue;
      const status = t.status === "draft" ? "draft" : "reviewed";
      await sql`
        insert into redemittel_translation (row_id, lang, translation, status, updated_at)
        values (${r.id}, ${t.lang}, ${t.translation}, ${status}, now())
        on conflict (row_id, lang) do update set translation = excluded.translation, status = excluded.status, updated_at = now()
      `;
    }
    ok++;
  }
  const [{ practiceable }] = await sql`select count(*) as practiceable from redemittel where parent_id is not null and (cardinality(tokens) > 0 or cloze_template is not null)`;
  console.log(`Imported ${ok} example child rows (skipped ${skipped}). Practiceable example children now: ${practiceable}.`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
