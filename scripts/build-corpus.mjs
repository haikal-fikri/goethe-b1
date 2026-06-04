#!/usr/bin/env node
/**
 * Liest alle data/corpus/*.json (von den Research-Subagenten erzeugt),
 * validiert die Tokenisierungs-Invariante, dedupliziert, vergibt stabile IDs
 * und schreibt einen konsolidierten Snapshot nach src/content/corpus.json,
 * den die App statisch importiert.
 *
 * Aufruf:  node scripts/build-corpus.mjs
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CORPUS_DIR = join(ROOT, "data", "corpus");
const OUT_DIR = join(ROOT, "src", "content");
const OUT_FILE = join(OUT_DIR, "corpus.json");

const LEVELS = new Set(["B1", "B2", "C1", "C2"]);
const SKILLS = new Set(["schreiben", "sprechen", "shared"]);

function stableId(item) {
  return createHash("sha1")
    .update(`${item.skill}|${item.task?.code}|${item.phrase}`)
    .digest("hex")
    .slice(0, 12);
}

function normalize(phrase) {
  return phrase.toLowerCase().replace(/\s+/g, " ").trim();
}

function main() {
  if (!existsSync(CORPUS_DIR)) {
    console.error(`Kein Korpus-Verzeichnis gefunden: ${CORPUS_DIR}`);
    process.exit(1);
  }
  const files = readdirSync(CORPUS_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error("Keine .json-Korpusdateien gefunden.");
    process.exit(1);
  }

  const all = [];
  const errors = [];
  for (const file of files) {
    const raw = readFileSync(join(CORPUS_DIR, file), "utf8");
    let arr;
    try {
      arr = JSON.parse(raw);
    } catch (e) {
      errors.push(`${file}: ungültiges JSON — ${e.message}`);
      continue;
    }
    if (!Array.isArray(arr)) {
      errors.push(`${file}: erwartet ein JSON-Array`);
      continue;
    }
    arr.forEach((item, i) => {
      const where = `${file}[${i}]`;
      if (!item || typeof item.phrase !== "string") {
        errors.push(`${where}: fehlendes 'phrase'`);
        return;
      }
      if (!Array.isArray(item.tokens) || item.tokens.length === 0) {
        errors.push(`${where}: fehlende 'tokens'`);
        return;
      }
      // Invariante
      if (item.tokens.join(" ") !== item.phrase) {
        errors.push(
          `${where}: tokens.join(" ") !== phrase\n   tokens="${item.tokens.join(
            " "
          )}"\n   phrase="${item.phrase}"`
        );
        return;
      }
      if (!LEVELS.has(item.level)) {
        errors.push(`${where}: ungültiges level '${item.level}'`);
        return;
      }
      if (!SKILLS.has(item.skill)) {
        errors.push(`${where}: ungültiges skill '${item.skill}'`);
        return;
      }
      if (typeof item.translation !== "string" || item.translation.length < 2) {
        errors.push(`${where}: fehlende 'translation'`);
        return;
      }
      all.push({
        id: stableId(item),
        phrase: item.phrase,
        frame: item.frame ?? null,
        translation: item.translation,
        level: item.level,
        skill: item.skill,
        task: item.task,
        function: item.function,
        registerGroup: item.registerGroup ?? null,
        tokens: item.tokens,
        distractors: Array.isArray(item.distractors) ? item.distractors : [],
        clozeTemplate: item.clozeTemplate ?? null,
        notes: item.notes ?? null,
        tags: Array.isArray(item.tags) ? item.tags : [],
        difficulty: typeof item.difficulty === "number" ? item.difficulty : 1,
      });
    });
  }

  // Dedupe (skill + normalisierte Phrase)
  const seen = new Map();
  const deduped = [];
  let dupes = 0;
  for (const item of all) {
    const key = `${item.skill}|${normalize(item.phrase)}`;
    if (seen.has(key)) {
      dupes++;
      continue;
    }
    seen.set(key, true);
    deduped.push(item);
  }

  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} Validierungsfehler:`);
    errors.slice(0, 40).forEach((e) => console.error("  - " + e));
    if (errors.length > 40) console.error(`  … und ${errors.length - 40} weitere`);
    // Wir brechen ab, damit fehlerhafte Items nicht in die App gelangen.
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(deduped, null, 2) + "\n", "utf8");

  // Statistik
  const byLevel = {};
  const bySkill = {};
  for (const it of deduped) {
    byLevel[it.level] = (byLevel[it.level] || 0) + 1;
    bySkill[it.skill] = (bySkill[it.skill] || 0) + 1;
  }
  console.log(`✅ ${deduped.length} Items geschrieben → ${OUT_FILE}`);
  console.log(`   Duplikate entfernt: ${dupes}`);
  console.log(`   nach Skill:`, bySkill);
  console.log(`   nach Niveau:`, byLevel);
}

main();
