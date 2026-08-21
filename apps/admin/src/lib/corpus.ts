import "server-only";
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { sql } from "@repo/server/db";
import {
  skillSchema,
  skillPatchSchema,
  corpusTaskSchema,
  corpusTaskPatchSchema,
  functionSchema,
  functionPatchSchema,
  redemittelSchema,
  redemittelPatchSchema,
  redemittelDeleteSchema,
  redemittelTranslationSchema,
  redemittelTranslationPatchSchema,
  redemittelTranslationDeleteSchema,
  createSimulationSchema,
  examTaskSchema,
} from "@repo/core";

// Schreibpfad des Korpus-Editors (teacher-lms/05 §4.2).
//
// Die Inhaltstabellen sind public-read und haben KEINE Client-Write-Policy —
// geschrieben wird ausschließlich hier, über die postgres.js-Verbindung
// (DATABASE_URL, umgeht RLS). `sql` aus @repo/server/db ist ein LAZY Proxy:
// der Import darf nicht werfen, weil `next build` Route-Module ohne
// DATABASE_URL lädt.
//
// SQL-Sicherheit: Werte stehen ausschließlich in ${}-Slots; dynamische
// Bezeichner (Spaltenlisten) entstehen über den sql()-Helfer aus explizit
// literal gebauten Objekten — niemals aus Nutzereingaben und nie via
// sql.unsafe().
//
// Auditierung: der audit_log-Eintrag läuft in DERSELBEN Transaktion wie die
// Mutation, nicht über den Best-Effort-Helfer lib/audit.ts. Ein Korpus-Write,
// der committet ohne Audit-Zeile, ist genau der Zustand, den §4.2 verhindern
// soll — hier gilt: beides oder nichts.

export const CORPUS_RESOURCES = [
  "skills",
  "tasks",
  "functions",
  "redemittel",
  "redemittel-translation",
  "exam-simulations",
  "exam-tasks",
] as const;
export type CorpusResource = (typeof CORPUS_RESOURCES)[number];

export function isCorpusResource(v: string): v is CorpusResource {
  return (CORPUS_RESOURCES as readonly string[]).includes(v);
}

export class CorpusError extends Error {
  readonly status: number;
  readonly code: "bad_request" | "not_found" | "conflict";

  // Felder bewusst ausgeschrieben statt als Parameter-Properties: die sind
  // reines TypeScript und lassen sich nicht bloß wegstreichen — Node
  // (--experimental-strip-types) lehnt sie ab, und daran hängt der
  // e2e-Testlauf gegen eine echte Datenbank.
  constructor(status: number, code: "bad_request" | "not_found" | "conflict", message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Tx = TransactionSql;
type Row = Record<string, unknown>;

export interface CorpusResult {
  /** Fachlicher Schlüssel der geschriebenen Zeile (für audit_log + Antwort). */
  id: string;
  action: "create" | "update" | "delete";
}

/**
 * audit_log-Meta bleibt bewusst flach und JSON-serialisierbar — und enthält
 * NUR Metadaten (geänderte Feldnamen, Zähler), niemals Inhalte (02 §7.1).
 */
type AuditMeta = Record<string, string | number | boolean | null | string[]>;

/** audit_log-Zeile in der laufenden Transaktion. */
async function auditTx(
  tx: Tx,
  entry: { actor: string; action: string; target: string; meta: AuditMeta }
): Promise<void> {
  await tx`
    insert into audit_log (actor, action, target, meta)
    values (${entry.actor}, ${entry.action}, ${entry.target}, ${tx.json(entry.meta)})
  `;
}

/** Nur gesetzte Felder übernehmen — undefined würde sonst Spalten nullen. */
function pick(src: Row, map: Record<string, string>): Row {
  const out: Row = {};
  for (const [from, col] of Object.entries(map)) {
    if (src[from] !== undefined) out[col] = src[from];
  }
  return out;
}

function requireFields(row: Row, resource: string): void {
  if (Object.keys(row).length === 0) {
    throw new CorpusError(400, "bad_request", `Keine Änderung übergeben (${resource}).`);
  }
}

/* ── Spalten-Abbildungen (literal, nie aus Eingaben abgeleitet) ────────────── */

// Zwei Karten je Ressource:
//   *_COLS        — Anlegen (enthält den Primärschlüssel)
//   *_UPDATE_COLS — Ändern (OHNE Primärschlüssel; der steht in der WHERE-Klausel)
// Der PK gehört nicht in ein SET: er erzeugte eine sinnlose Selbstzuweisung und
// machte vor allem requireFields() wirkungslos — ein PATCH ganz ohne Änderung
// wäre als „Erfolg" durchgelaufen und hätte eine Audit-Zeile ohne Vorgang
// hinterlassen.
const SKILL_COLS = { code: "code", nameDe: "name_de", sortOrder: "sort_order" };
const SKILL_UPDATE_COLS = { nameDe: "name_de", sortOrder: "sort_order" };

const TASK_COLS = {
  code: "code",
  skillCode: "skill_code",
  labelDe: "label_de",
  labelEn: "label_en",
  sortOrder: "sort_order",
};
const TASK_UPDATE_COLS = {
  skillCode: "skill_code",
  labelDe: "label_de",
  labelEn: "label_en",
  sortOrder: "sort_order",
};

const FUNCTION_COLS = { code: "code", nameDe: "name_de", nameEn: "name_en" };
const FUNCTION_UPDATE_COLS = { nameDe: "name_de", nameEn: "name_en" };
const REDEMITTEL_COLS = {
  id: "id",
  phraseDe: "phrase_de",
  frameDe: "frame_de",
  translationEn: "translation_en",
  level: "level",
  skillCode: "skill_code",
  taskCode: "task_code",
  functionCode: "function_code",
  registerGroup: "register_group",
  notes: "notes",
  clozeTemplate: "cloze_template",
  audioUrl: "audio_url",
  tokens: "tokens",
  distractors: "distractors",
  tags: "tags",
  difficulty: "difficulty",
  parentId: "parent_id",
};
/**
 * Ändern lässt sich alles AUSSER `id` (stabiler Surrogatschlüssel) und
 * `parent_id`. Letzteres ist der eigentliche Zahn: wer parent_id nachträglich
 * setzen kann, macht aus einer geschützten kanonischen Wendung eine löschbare
 * Beispielzeile — und entfernt sie zugleich aus redemittel_item, also aus der
 * Lern-App. Die Eltern-Zuordnung fällt beim Anlegen, danach nur per Migration.
 */
const REDEMITTEL_UPDATE_COLS = {
  phraseDe: "phrase_de",
  frameDe: "frame_de",
  translationEn: "translation_en",
  level: "level",
  skillCode: "skill_code",
  taskCode: "task_code",
  functionCode: "function_code",
  registerGroup: "register_group",
  notes: "notes",
  clozeTemplate: "cloze_template",
  audioUrl: "audio_url",
  tokens: "tokens",
  distractors: "distractors",
  tags: "tags",
  difficulty: "difficulty",
};

const TRANSLATION_COLS = {
  rowId: "row_id",
  lang: "lang",
  translation: "translation",
  status: "status",
  translator: "translator",
};

/** exam_tasks brauchen zusätzlich die Simulation, zu der sie gehören. */
const examTaskCreateSchema = examTaskSchema.extend({
  simulationId: z.number().int().positive(),
});
// NICHT von examTaskSchema ableiten: dessen `bulletPointsDe` trägt ein
// `.default([])`, das `.partial()` in Zod v4 NICHT entfernt — jeder Patch
// hätte die Leitpunkte der Aufgabe gelöscht, auch wenn der Aufrufer sie gar
// nicht erwähnt. Diese Ressource hat keine Oberfläche, der rohe API-Aufruf ist
// der einzige Weg; ein stiller Datenverlust wäre hier unbemerkt geblieben.
const examTaskPatchSchema = z.object({
  id: z.string().trim().min(1).max(120),
  taskType: z.string().min(1).max(120).optional(),
  titleDe: z.string().min(1).max(300).optional(),
  promptDe: z.string().min(1).max(8000).optional(),
  bulletPointsDe: z.array(z.string().max(500)).max(20).optional(),
  minWords: z.number().int().positive().max(10000).optional(),
  recommendedMinutes: z.number().int().positive().max(600).optional(),
  sampleAnswerDe: z.string().max(12000).optional(),
});
const examSimulationPatchSchema = z.object({
  id: z.number().int().positive(),
  titleDe: z.string().trim().min(1).max(300).optional(),
  sortOrder: z.number().int().min(0).max(32767).optional(),
});

/* ── Öffentliche Einstiegspunkte ──────────────────────────────────────────── */

export async function createCorpus(
  resource: CorpusResource,
  body: unknown,
  actor: string
): Promise<CorpusResult> {
  switch (resource) {
    case "skills":
      return simpleInsert("skills", SKILL_COLS, skillSchema.parse(body), "code", actor);
    case "tasks":
      return simpleInsert("tasks", TASK_COLS, corpusTaskSchema.parse(body), "code", actor);
    case "functions":
      return simpleInsert("functions", FUNCTION_COLS, functionSchema.parse(body), "code", actor);
    case "redemittel":
      return createRedemittel(redemittelSchema.parse(body), actor);
    case "redemittel-translation":
      return createTranslation(redemittelTranslationSchema.parse(body), actor);
    case "exam-simulations":
      return createSimulation(createSimulationSchema.parse(body), actor);
    case "exam-tasks":
      return createExamTask(examTaskCreateSchema.parse(body), actor);
  }
}

export async function updateCorpus(
  resource: CorpusResource,
  body: unknown,
  actor: string
): Promise<CorpusResult> {
  switch (resource) {
    case "skills": {
      const d = skillPatchSchema.parse(body);
      return simpleUpdate("skills", "code", d.code, pick(d, SKILL_UPDATE_COLS), actor, "skills");
    }
    case "tasks": {
      const d = corpusTaskPatchSchema.parse(body);
      return simpleUpdate("tasks", "code", d.code, pick(d, TASK_UPDATE_COLS), actor, "tasks");
    }
    case "functions": {
      const d = functionPatchSchema.parse(body);
      return simpleUpdate("functions", "code", d.code, pick(d, FUNCTION_UPDATE_COLS), actor, "functions");
    }
    case "redemittel": {
      const d = redemittelPatchSchema.parse(body);
      return simpleUpdate("redemittel", "id", d.id, pick(d, REDEMITTEL_UPDATE_COLS), actor, "redemittel");
    }
    case "redemittel-translation":
      return updateTranslation(redemittelTranslationPatchSchema.parse(body), actor);
    case "exam-simulations": {
      const d = examSimulationPatchSchema.parse(body);
      const row = pick(d as Row, { titleDe: "title_de", sortOrder: "sort_order" });
      return simpleUpdate("exam_simulations", "id", d.id, row, actor, "exam_simulations");
    }
    case "exam-tasks": {
      const d = examTaskPatchSchema.parse(body);
      const row = pick(d as Row, {
        taskType: "task_type",
        titleDe: "title_de",
        promptDe: "prompt_de",
        bulletPointsDe: "bullet_points_de",
        minWords: "min_words",
        recommendedMinutes: "recommended_minutes",
        sampleAnswerDe: "sample_answer_de",
      });
      return simpleUpdate("exam_tasks", "id", d.id, row, actor, "exam_tasks");
    }
  }
}

export async function deleteCorpus(
  resource: CorpusResource,
  body: unknown,
  actor: string
): Promise<CorpusResult> {
  // Bewusst nur zwei löschbare Ressourcen. Kategorien (skills/tasks/functions),
  // kanonische Redemittel und Prüfungsinhalte hängen an Fremdschlüsseln und an
  // der Lernhistorie — dort ist eine Hand-Migration der richtige Weg.
  if (resource === "redemittel-translation") {
    return deleteTranslation(redemittelTranslationDeleteSchema.parse(body), actor);
  }
  if (resource === "redemittel") {
    return deleteRedemittelChild(redemittelDeleteSchema.parse(body), actor);
  }
  throw new CorpusError(
    400,
    "bad_request",
    `${resource} kann nicht gelöscht werden — dafür bitte eine SQL-Migration schreiben.`
  );
}

/* ── Generische Implementierungen ─────────────────────────────────────────── */

async function simpleInsert(
  table: string,
  cols: Record<string, string>,
  parsed: Row,
  pkField: string,
  actor: string
): Promise<CorpusResult> {
  const row = pick(parsed, cols);
  const id = String(parsed[pkField]);
  await sql.begin(async (tx) => {
    await tx`insert into ${tx(table)} ${tx(row)}`;
    await auditTx(tx, {
      actor,
      action: "corpus.create",
      target: `${table}:${id}`,
      meta: { felder: Object.keys(row), via: "admin" },
    });
  });
  return { id, action: "create" };
}

async function simpleUpdate(
  table: string,
  pkCol: string,
  pkValue: string | number,
  row: Row,
  actor: string,
  auditTable: string
): Promise<CorpusResult> {
  requireFields(row, table);
  const keys = Object.keys(row);
  await sql.begin(async (tx) => {
    const res = await tx`
      update ${tx(table)} set ${tx(row, ...keys)} where ${tx(pkCol)} = ${pkValue}
    `;
    if (res.count === 0) {
      throw new CorpusError(404, "not_found", `${table}: ${pkValue} existiert nicht.`);
    }
    await auditTx(tx, {
      actor,
      action: "corpus.update",
      target: `${auditTable}:${pkValue}`,
      meta: { felder: keys, via: "admin" },
    });
  });
  return { id: String(pkValue), action: "update" };
}

/* ── redemittel ───────────────────────────────────────────────────────────── */

async function createRedemittel(d: Row, actor: string): Promise<CorpusResult> {
  const row = pick(d, REDEMITTEL_COLS);
  const id = String(d.id);
  await sql.begin(async (tx) => {
    if (d.parentId) {
      const parent = await tx`select 1 from redemittel where id = ${String(d.parentId)}`;
      if (parent.count === 0) {
        throw new CorpusError(400, "bad_request", `Eltern-Wendung ${String(d.parentId)} existiert nicht.`);
      }
    }
    await tx`insert into redemittel ${tx(row)}`;
    await auditTx(tx, {
      actor,
      action: "corpus.create",
      target: `redemittel:${id}`,
      meta: { felder: Object.keys(row), kind: d.parentId ? "beispiel" : "kanonisch", via: "admin" },
    });
  });
  return { id, action: "create" };
}

/** Nur Beispiel-Kindzeilen sind löschbar — kanonische IDs tragen Lernhistorie. */
async function deleteRedemittelChild(d: { id: string }, actor: string): Promise<CorpusResult> {
  await sql.begin(async (tx) => {
    const rows = await tx<{ parent_id: string | null }[]>`
      select parent_id from redemittel where id = ${d.id}
    `;
    if (rows.length === 0) throw new CorpusError(404, "not_found", `redemittel: ${d.id} existiert nicht.`);
    if (!rows[0].parent_id) {
      throw new CorpusError(
        409,
        "conflict",
        "Kanonische Wendungen werden nicht gelöscht (Attempts, Fortschritt und Übersetzungen hängen an der ID). Bitte in einer SQL-Migration behandeln."
      );
    }
    await tx`delete from redemittel where id = ${d.id}`;
    await auditTx(tx, {
      actor,
      action: "corpus.delete",
      target: `redemittel:${d.id}`,
      meta: { kind: "beispiel", via: "admin" },
    });
  });
  return { id: d.id, action: "delete" };
}

/* ── redemittel_translation (zusammengesetzter PK) ────────────────────────── */

async function createTranslation(d: Row, actor: string): Promise<CorpusResult> {
  const row = pick(d, TRANSLATION_COLS);
  const key = `${String(d.rowId)}:${String(d.lang)}`;
  await sql.begin(async (tx) => {
    const parent = await tx`select 1 from redemittel where id = ${String(d.rowId)}`;
    if (parent.count === 0) {
      throw new CorpusError(400, "bad_request", `Wendung ${String(d.rowId)} existiert nicht.`);
    }
    // `coalesce(excluded.x, tabelle.x)` statt `excluded.x`: hat der Aufrufer
    // ein optionales Feld weggelassen, steht es nicht in der INSERT-Liste, und
    // `excluded.translator` wäre der Spalten-Default (NULL) — der Upsert würde
    // also den gespeicherten Übersetzer löschen und einen geprüften Eintrag
    // auf „reviewed" zurückstellen. So bleibt Ausgelassenes erhalten.
    await tx`
      insert into redemittel_translation ${tx(row)}
      on conflict (row_id, lang) do update set
        translation = excluded.translation,
        status      = coalesce(excluded.status, redemittel_translation.status),
        translator  = coalesce(excluded.translator, redemittel_translation.translator),
        updated_at  = now()
    `;
    await auditTx(tx, {
      actor,
      action: "corpus.update",
      target: `redemittel_translation:${key}`,
      meta: { felder: Object.keys(row), via: "admin" },
    });
  });
  return { id: key, action: "create" };
}

async function updateTranslation(d: Row, actor: string): Promise<CorpusResult> {
  const row = pick(d, TRANSLATION_COLS);
  // row_id/lang sind der Schlüssel, nicht Teil der Änderung.
  delete row.row_id;
  delete row.lang;
  requireFields(row, "redemittel_translation");
  const keys = Object.keys(row);
  const key = `${String(d.rowId)}:${String(d.lang)}`;
  await sql.begin(async (tx) => {
    const res = await tx`
      update redemittel_translation set ${tx(row, ...keys)}, updated_at = now()
      where row_id = ${String(d.rowId)} and lang = ${String(d.lang)}
    `;
    if (res.count === 0) throw new CorpusError(404, "not_found", `Übersetzung ${key} existiert nicht.`);
    await auditTx(tx, {
      actor,
      action: "corpus.update",
      target: `redemittel_translation:${key}`,
      meta: { felder: keys, via: "admin" },
    });
  });
  return { id: key, action: "update" };
}

async function deleteTranslation(d: { rowId: string; lang: string }, actor: string): Promise<CorpusResult> {
  const key = `${d.rowId}:${d.lang}`;
  await sql.begin(async (tx) => {
    const res = await tx`
      delete from redemittel_translation where row_id = ${d.rowId} and lang = ${d.lang}
    `;
    if (res.count === 0) throw new CorpusError(404, "not_found", `Übersetzung ${key} existiert nicht.`);
    await auditTx(tx, {
      actor,
      action: "corpus.delete",
      target: `redemittel_translation:${key}`,
      meta: { via: "admin" },
    });
  });
  return { id: key, action: "delete" };
}

/* ── Prüfungsinhalte ──────────────────────────────────────────────────────── */

interface SimulationTask {
  aufgabe: number;
  taskType: string;
  titleDe: string;
  promptDe: string;
  bulletPointsDe: string[];
  minWords: number;
  recommendedMinutes?: number;
  sampleAnswerDe?: string;
}

/**
 * §4.3 — die ID-Vergabe war rennanfällig: der Legacy-Pfad las
 * `coalesce(max(id),0)+1` und schrieb ohne Serialisierung, sodass zwei
 * gleichzeitige Autoren dieselbe ID lasen (einer lief in einen PK-Konflikt und
 * bekam einen generischen 500). `pg_advisory_xact_lock` serialisiert Lesen und
 * Schreiben über Sessions hinweg; die Sperre fällt beim Commit/Rollback
 * automatisch. Zero-Migration-Fix — die Inhaltstabellen bleiben unangetastet.
 *
 * ⚠️ Eine Sperre wirkt nur zwischen Beteiligten, die sie AUCH nehmen. Solange
 * apps/web `/api/admin/simulations` lebt und dieselbe Berechnung ungesichert
 * ausführt, ist das Rennen zwischen den beiden Apps offen — geschlossen ist es
 * erst mit der Abschaltung des Legacy-Panels (§5.1). Die beiden Schritte
 * gehören zusammen; §5.1 fordert sie ausdrücklich im selben Release.
 */
async function createSimulation(
  d: { titleDe: string; tasks: SimulationTask[] },
  actor: string
): Promise<CorpusResult> {
  const id = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('exam_simulations_id'))`;
    const [{ id: simId }] = await tx<{ id: number }[]>`
      select coalesce(max(id), 0) + 1 as id from exam_simulations
    `;
    await tx`
      insert into exam_simulations (id, title_de, sort_order)
      values (${simId}, ${d.titleDe}, ${simId})
    `;
    for (const t of d.tasks) {
      await tx`
        insert into exam_tasks (
          id, simulation_id, aufgabe, task_type, title_de, prompt_de,
          bullet_points_de, min_words, recommended_minutes, sample_answer_de, sort_order
        ) values (
          ${`s${simId}-a${t.aufgabe}`}, ${simId}, ${t.aufgabe}, ${t.taskType}, ${t.titleDe},
          ${t.promptDe}, ${t.bulletPointsDe}, ${t.minWords},
          ${t.recommendedMinutes ?? null}, ${t.sampleAnswerDe ?? null}, ${t.aufgabe - 1}
        )
      `;
    }
    await auditTx(tx, {
      actor,
      action: "corpus.create",
      target: `exam_simulations:${simId}`,
      meta: { aufgaben: d.tasks.length, via: "admin" },
    });
    return simId;
  });
  return { id: String(id), action: "create" };
}

async function createExamTask(d: Row, actor: string): Promise<CorpusResult> {
  const simId = Number(d.simulationId);
  const aufgabe = Number(d.aufgabe);
  const id = `s${simId}-a${aufgabe}`;
  await sql.begin(async (tx) => {
    const sim = await tx`select 1 from exam_simulations where id = ${simId}`;
    if (sim.count === 0) {
      throw new CorpusError(400, "bad_request", `Simulation ${simId} existiert nicht.`);
    }
    const dupe = await tx`select 1 from exam_tasks where id = ${id}`;
    if (dupe.count > 0) {
      throw new CorpusError(409, "conflict", `Aufgabe ${aufgabe} existiert in dieser Simulation bereits.`);
    }
    await tx`
      insert into exam_tasks (
        id, simulation_id, aufgabe, task_type, title_de, prompt_de,
        bullet_points_de, min_words, recommended_minutes, sample_answer_de, sort_order
      ) values (
        ${id}, ${simId}, ${aufgabe}, ${String(d.taskType)}, ${String(d.titleDe)},
        ${String(d.promptDe)}, ${(d.bulletPointsDe as string[]) ?? []}, ${Number(d.minWords)},
        ${(d.recommendedMinutes as number | undefined) ?? null},
        ${(d.sampleAnswerDe as string | undefined) ?? null}, ${aufgabe - 1}
      )
    `;
    await auditTx(tx, {
      actor,
      action: "corpus.create",
      target: `exam_tasks:${id}`,
      meta: { simulation: simId, aufgabe, via: "admin" },
    });
  });
  return { id, action: "create" };
}
