#!/usr/bin/env node
/**
 * Expert TRANSLATION import (service-role / DB-direct, idempotent).
 *
 * Upserts into redemittel_translation on (row_id, lang). Only status='reviewed' rows
 * reach learners (the mobile overlay filters). A language stays enabled=false in Settings
 * until coverage clears the bar — see the v_translation_coverage view (printed at the end).
 *
 * Input: a JSON array [{ row_id, lang, translation, status?, translator? }] via a file
 * arg or stdin. `row_id` may be a canonical Wendung OR an example child id.
 *
 *   DATABASE_URL=... node scripts/import-translations.mjs translations.json
 *   cat translations.json | DATABASE_URL=... node scripts/import-translations.mjs
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
  if (!Array.isArray(rows)) throw new Error("Input must be a JSON array of translation rows.");
  return rows;
}

const sql = postgres(dbUrl(), { ssl: "require" });

async function main() {
  const rows = readInput();
  let ok = 0, skipped = 0;
  for (const r of rows) {
    if (!r.row_id || !r.lang || r.translation == null) { skipped++; continue; }
    const status = r.status === "draft" ? "draft" : "reviewed";
    await sql`
      insert into redemittel_translation (row_id, lang, translation, status, translator, updated_at)
      values (${r.row_id}, ${r.lang}, ${r.translation}, ${status}, ${r.translator ?? null}, now())
      on conflict (row_id, lang) do update
        set translation = excluded.translation, status = excluded.status,
            translator = excluded.translator, updated_at = now()
    `;
    ok++;
  }
  const cov = await sql`select code, enabled, reviewed, canonical from v_translation_coverage order by code`;
  console.log(`Imported ${ok} translation rows (skipped ${skipped} incomplete).`);
  console.table(cov.map((c) => ({
    lang: c.code, reviewed: Number(c.reviewed), canonical: Number(c.canonical),
    pct: Number(c.canonical) ? Math.round((100 * Number(c.reviewed)) / Number(c.canonical)) : 0,
    enabled: c.enabled,
  })));
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
