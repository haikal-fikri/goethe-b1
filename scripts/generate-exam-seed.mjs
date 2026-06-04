#!/usr/bin/env node
/**
 * Erzeugt aus data/exam/simulations.json ein idempotentes supabase/seed_exam.sql
 * (exam_simulations + exam_tasks). Einspielen z.B. mit:
 *   psql "$DATABASE_URL" -f supabase/migrations/0002_exam_schema.sql
 *   psql "$DATABASE_URL" -f supabase/seed_exam.sql
 *
 * Aufruf: node scripts/generate-exam-seed.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SIMS = JSON.parse(
  readFileSync(join(ROOT, "data", "exam", "simulations.json"), "utf8")
);
const OUT = join(ROOT, "supabase", "seed_exam.sql");

const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) =>
  `array[${(a ?? [])
    .map((x) => `'${String(x).replace(/'/g, "''")}'`)
    .join(",")}]::text[]`;

const lines = [];
lines.push("-- Auto-generiert von scripts/generate-exam-seed.mjs — nicht von Hand editieren.");
lines.push("begin;");

SIMS.forEach((sim, si) => {
  lines.push(
    `insert into exam_simulations (id, title_de, sort_order) values (${sim.id}, ${q(
      sim.titleDe
    )}, ${si}) on conflict (id) do update set title_de = excluded.title_de, sort_order = excluded.sort_order;`
  );
  sim.tasks.forEach((t, ti) => {
    lines.push(
      `insert into exam_tasks (id, simulation_id, aufgabe, task_type, title_de, prompt_de, bullet_points_de, min_words, recommended_minutes, sample_answer_de, sort_order) values (` +
        [
          q(t.id),
          sim.id,
          t.aufgabe,
          q(t.taskType),
          q(t.titleDe),
          q(t.promptDe),
          arr(t.bulletPointsDe),
          t.minWords ?? 80,
          t.recommendedMinutes == null ? "null" : t.recommendedMinutes,
          q(t.sampleAnswerDe),
          ti,
        ].join(", ") +
        `) on conflict (id) do update set simulation_id=excluded.simulation_id, aufgabe=excluded.aufgabe, task_type=excluded.task_type, title_de=excluded.title_de, prompt_de=excluded.prompt_de, bullet_points_de=excluded.bullet_points_de, min_words=excluded.min_words, recommended_minutes=excluded.recommended_minutes, sample_answer_de=excluded.sample_answer_de, sort_order=excluded.sort_order;`
    );
  });
});

lines.push("commit;");
writeFileSync(OUT, lines.join("\n") + "\n", "utf8");

const taskCount = SIMS.reduce((n, s) => n + s.tasks.length, 0);
console.log(`✅ ${SIMS.length} Simulationen + ${taskCount} Aufgaben → ${OUT}`);
