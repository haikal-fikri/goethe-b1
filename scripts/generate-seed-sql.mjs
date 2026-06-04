#!/usr/bin/env node
/**
 * Erzeugt aus src/content/corpus.json ein idempotentes supabase/seed.sql
 * (Lookups + redemittel). Einspielen z.B. mit:
 *   psql "$DATABASE_URL" -f supabase/migrations/0001_content_schema.sql
 *   psql "$DATABASE_URL" -f supabase/seed.sql
 *
 * Aufruf: node scripts/generate-seed-sql.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ITEMS = JSON.parse(
  readFileSync(join(ROOT, "src", "content", "corpus.json"), "utf8")
);
const OUT = join(ROOT, "supabase", "seed.sql");

const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) =>
  `array[${(a ?? [])
    .map((x) => `'${String(x).replace(/'/g, "''")}'`)
    .join(",")}]::text[]`;

const skills = new Map();
const tasks = new Map();
const functions = new Map();

const SKILL_NAME = {
  schreiben: "Schreiben",
  sprechen: "Sprechen",
  shared: "Konnektoren",
};

for (const it of ITEMS) {
  skills.set(it.skill, SKILL_NAME[it.skill] ?? it.skill);
  tasks.set(it.task.code, { ...it.task, skill: it.skill });
  functions.set(it.function.code, it.function);
}

const lines = [];
lines.push("-- Auto-generiert von scripts/generate-seed-sql.mjs — nicht von Hand editieren.");
lines.push("begin;");

// skills
for (const [code, name] of skills) {
  lines.push(
    `insert into skills (code, name_de) values (${q(code)}, ${q(
      name
    )}) on conflict (code) do update set name_de = excluded.name_de;`
  );
}
// tasks
for (const [code, t] of tasks) {
  lines.push(
    `insert into tasks (code, skill_code, label_de, label_en) values (${q(
      code
    )}, ${q(t.skill)}, ${q(t.labelDe)}, ${q(
      t.labelEn
    )}) on conflict (code) do update set label_de = excluded.label_de, label_en = excluded.label_en;`
  );
}
// functions
for (const [code, f] of functions) {
  lines.push(
    `insert into functions (code, name_de, name_en) values (${q(code)}, ${q(
      f.nameDe
    )}, ${q(
      f.nameEn
    )}) on conflict (code) do update set name_de = excluded.name_de, name_en = excluded.name_en;`
  );
}

// redemittel
for (const it of ITEMS) {
  lines.push(
    `insert into redemittel (id, phrase_de, frame_de, translation_en, level, skill_code, task_code, function_code, register_group, notes, cloze_template, tokens, distractors, tags, difficulty) values (` +
      [
        q(it.id),
        q(it.phrase),
        q(it.frame),
        q(it.translation),
        q(it.level),
        q(it.skill),
        q(it.task.code),
        q(it.function.code),
        q(it.registerGroup),
        q(it.notes),
        q(it.clozeTemplate),
        arr(it.tokens),
        arr(it.distractors),
        arr(it.tags),
        it.difficulty ?? 1,
      ].join(", ") +
      `) on conflict (id) do update set phrase_de=excluded.phrase_de, translation_en=excluded.translation_en, tokens=excluded.tokens, distractors=excluded.distractors;`
  );
}

lines.push("commit;");
writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
console.log(
  `✅ ${ITEMS.length} Items + ${skills.size} Skills/${tasks.size} Tasks/${functions.size} Functions → ${OUT}`
);
