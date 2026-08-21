import type { SupabaseClient } from "@supabase/supabase-js";

// Lesepfad des Korpus-Editors. Die Inhaltstabellen sind public-read, also
// genügt der normale SSR-Client; geschrieben wird ausschließlich über
// /api/admin/corpus/:resource (lib/corpus.ts).

/**
 * Die öffentliche Web-App zeigt nur die ersten N Simulationen (sortiert nach
 * sort_order, id) — siehe PUBLIC_SIMULATION_LIMIT in apps/web/src/lib/exam.ts.
 * Der anonyme Bewertungspfad lehnt Aufgaben darüber hinaus ebenfalls ab.
 * Hier gespiegelt, damit die Redaktion sieht, dass eine NEU angelegte
 * Simulation auf /pruefen absichtlich nicht auftaucht (sie ist der bezahlten
 * mobilen App vorbehalten). ⚠️ Muss mit apps/web übereinstimmen.
 */
export const PUBLIC_SIMULATION_LIMIT = 2;

export interface SimulationRow {
  id: number;
  titleDe: string;
  sortOrder: number;
  aufgaben: number;
  createdAt: string;
  /** Sichtbar in der öffentlichen Web-App (erste N nach sort_order, id). */
  oeffentlich: boolean;
}

export interface ExamTaskRow {
  id: string;
  aufgabe: number;
  taskType: string;
  titleDe: string;
  promptDe: string;
  bulletPointsDe: string[];
  minWords: number;
  recommendedMinutes: number | null;
  sampleAnswerDe: string | null;
}

export interface SimulationDetail extends SimulationRow {
  tasks: ExamTaskRow[];
}

type Row = Record<string, unknown>;
const rows = (d: unknown): Row[] => (Array.isArray(d) ? (d as Row[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export async function listSimulations(sb: SupabaseClient): Promise<SimulationRow[]> {
  const { data, error } = await sb
    .from("exam_simulations")
    .select("id, title_de, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) return [];

  const sims = rows(data);
  if (sims.length === 0) return [];

  const { data: taskData } = await sb
    .from("exam_tasks")
    .select("simulation_id")
    .in("simulation_id", sims.map((s) => num(s.id)));

  const counts = new Map<number, number>();
  for (const t of rows(taskData)) {
    const sid = num(t.simulation_id);
    counts.set(sid, (counts.get(sid) ?? 0) + 1);
  }

  return sims.map((s, i) => ({
    id: num(s.id),
    titleDe: str(s.title_de),
    sortOrder: num(s.sort_order),
    aufgaben: counts.get(num(s.id)) ?? 0,
    createdAt: str(s.created_at),
    oeffentlich: i < PUBLIC_SIMULATION_LIMIT,
  }));
}

export async function getSimulation(sb: SupabaseClient, id: number): Promise<SimulationDetail | null> {
  const { data, error } = await sb
    .from("exam_simulations")
    .select("id, title_de, sort_order, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const s = data as Row;

  const { data: taskData } = await sb
    .from("exam_tasks")
    .select(
      "id, aufgabe, task_type, title_de, prompt_de, bullet_points_de, min_words, recommended_minutes, sample_answer_de"
    )
    .eq("simulation_id", id)
    .order("aufgabe", { ascending: true });

  // Öffentlichkeit ergibt sich aus der Position in der kanonischen Sortierung.
  const alle = await listSimulations(sb);
  const oeffentlich = alle.find((x) => x.id === id)?.oeffentlich ?? false;

  return {
    id: num(s.id),
    titleDe: str(s.title_de),
    sortOrder: num(s.sort_order),
    createdAt: str(s.created_at),
    aufgaben: rows(taskData).length,
    oeffentlich,
    tasks: rows(taskData).map((t) => ({
      id: str(t.id),
      aufgabe: num(t.aufgabe),
      taskType: str(t.task_type),
      titleDe: str(t.title_de),
      promptDe: str(t.prompt_de),
      bulletPointsDe: arr(t.bullet_points_de),
      minWords: num(t.min_words),
      recommendedMinutes: t.recommended_minutes === null ? null : num(t.recommended_minutes),
      sampleAnswerDe: t.sample_answer_de === null ? null : str(t.sample_answer_de),
    })),
  };
}

/* ── Generischer Ressourcen-Browser ───────────────────────────────────────── */

export interface ResourceField {
  /** Feldname im API-Body (camelCase). */
  name: string;
  /** Zugehörige DB-Spalte — explizit, damit das Vorbefüllen nicht raten muss. */
  col: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "list";
  options?: string[];
  required?: boolean;
  /** Teil des Primärschlüssels — beim Bearbeiten nicht änderbar. */
  pk?: boolean;
  hint?: string;
}

export interface ResourceConfig {
  slug: string;
  table: string;
  titel: string;
  beschreibung: string;
  /** Spalten in der Übersichtstabelle (DB-Spaltennamen). */
  listColumns: Array<{ col: string; label: string }>;
  orderBy: string;
  fields: ResourceField[];
  /** Löschen erlaubt (siehe lib/corpus.ts — bewusst restriktiv). */
  loeschbar: boolean;
}

const SKILL_CODES = ["schreiben", "sprechen", "shared"];
const LEVELS = ["B1", "B2", "C1", "C2"];

export const RESOURCES: ResourceConfig[] = [
  {
    slug: "skills",
    table: "skills",
    titel: "Fertigkeiten",
    beschreibung: "Oberste Gliederung (schreiben / sprechen / übergreifend).",
    listColumns: [
      { col: "code", label: "Code" },
      { col: "name_de", label: "Name" },
      { col: "sort_order", label: "Reihenfolge" },
    ],
    orderBy: "sort_order",
    loeschbar: false,
    fields: [
      { name: "code", col: "code", label: "Code", type: "select", options: SKILL_CODES, required: true, pk: true },
      { name: "nameDe", col: "name_de", label: "Name (DE)", type: "text", required: true },
      { name: "sortOrder", col: "sort_order", label: "Reihenfolge", type: "number" },
    ],
  },
  {
    slug: "tasks",
    table: "tasks",
    titel: "Aufgabentypen",
    beschreibung:
      "Kategorien der Redemittel (NICHT die Prüfungsaufgaben — die stehen unter Simulationen).",
    listColumns: [
      { col: "code", label: "Code" },
      { col: "label_de", label: "Label (DE)" },
      { col: "label_en", label: "Label (EN)" },
      { col: "skill_code", label: "Fertigkeit" },
    ],
    orderBy: "sort_order",
    loeschbar: false,
    fields: [
      { name: "code", col: "code", label: "Code", type: "text", required: true, pk: true },
      { name: "skillCode", col: "skill_code", label: "Fertigkeit", type: "select", options: SKILL_CODES, required: true },
      { name: "labelDe", col: "label_de", label: "Label (DE)", type: "text", required: true },
      { name: "labelEn", col: "label_en", label: "Label (EN)", type: "text", required: true },
      { name: "sortOrder", col: "sort_order", label: "Reihenfolge", type: "number" },
    ],
  },
  {
    slug: "functions",
    table: "functions",
    titel: "Funktionen",
    beschreibung: "Sprachfunktionen, z. B. „Meinung äußern“.",
    listColumns: [
      { col: "code", label: "Code" },
      { col: "name_de", label: "Name (DE)" },
      { col: "name_en", label: "Name (EN)" },
    ],
    orderBy: "code",
    loeschbar: false,
    fields: [
      { name: "code", col: "code", label: "Code", type: "text", required: true, pk: true },
      { name: "nameDe", col: "name_de", label: "Name (DE)", type: "text", required: true },
      { name: "nameEn", col: "name_en", label: "Name (EN)", type: "text", required: true },
    ],
  },
  {
    slug: "redemittel",
    table: "redemittel",
    titel: "Redemittel",
    beschreibung:
      "Die Wendungen selbst. Die ID ist ein STABILER Schlüssel — Bearbeiten heißt Ändern an Ort und Stelle, nie neu anlegen.",
    listColumns: [
      { col: "id", label: "ID" },
      { col: "phrase_de", label: "Wendung" },
      { col: "level", label: "Niveau" },
      { col: "skill_code", label: "Fertigkeit" },
    ],
    orderBy: "id",
    loeschbar: true,
    fields: [
      { name: "id", col: "id", label: "ID", type: "text", required: true, pk: true, hint: "Stabiler Schlüssel — nie ändern." },
      {
        name: "phraseDe",
        col: "phrase_de",
        label: "Wendung (DE)",
        type: "text",
        required: true,
        hint: 'Muss exakt tokens.join(" ") entsprechen.',
      },
      {
        name: "tokens",
        col: "tokens",
        label: "Tokens (Wortbank)",
        type: "list",
        required: true,
        hint: "Ein Token pro Zeile. Zusammengefügt mit Leerzeichen muss die Wendung herauskommen.",
      },
      { name: "translationEn", col: "translation_en", label: "Übersetzung (EN)", type: "text", required: true },
      { name: "level", col: "level", label: "Niveau", type: "select", options: LEVELS, required: true },
      { name: "skillCode", col: "skill_code", label: "Fertigkeit", type: "select", options: SKILL_CODES, required: true },
      { name: "taskCode", col: "task_code", label: "Aufgabentyp (Code)", type: "text", required: true },
      { name: "functionCode", col: "function_code", label: "Funktion (Code)", type: "text", required: true },
      { name: "frameDe", col: "frame_de", label: "Rahmen (DE)", type: "text" },
      { name: "clozeTemplate", col: "cloze_template", label: "Lückentext-Vorlage", type: "textarea", hint: "Lücken als {{…}}." },
      {
        name: "distractors",
        col: "distractors",
        label: "Distraktoren",
        type: "list",
        hint: "ABSICHTLICHE Falschschreibungen — nicht korrigieren.",
      },
      { name: "tags", col: "tags", label: "Tags", type: "list" },
      { name: "registerGroup", col: "register_group", label: "Register", type: "text" },
      { name: "notes", col: "notes", label: "Notizen", type: "textarea" },
      { name: "difficulty", col: "difficulty", label: "Schwierigkeit (1–5)", type: "number" },
      {
        name: "parentId",
        col: "parent_id",
        label: "Eltern-ID (Beispielzeile)",
        type: "text",
        hint: "Gesetzt = Beispielsatz zu dieser Wendung. Nur solche Zeilen sind löschbar.",
      },
    ],
  },
  {
    slug: "redemittel-translation",
    table: "redemittel_translation",
    titel: "Übersetzungen",
    beschreibung: "Eine Zeile je Wendung × Sprache.",
    listColumns: [
      { col: "row_id", label: "Wendung" },
      { col: "lang", label: "Sprache" },
      { col: "translation", label: "Übersetzung" },
      { col: "status", label: "Status" },
    ],
    orderBy: "row_id",
    loeschbar: true,
    fields: [
      { name: "rowId", col: "row_id", label: "Wendungs-ID", type: "text", required: true, pk: true },
      { name: "lang", col: "lang", label: "Sprachcode", type: "text", required: true, pk: true, hint: "z. B. en, id" },
      { name: "translation", col: "translation", label: "Übersetzung", type: "textarea", required: true },
      { name: "status", col: "status", label: "Status", type: "select", options: ["reviewed", "draft"] },
      { name: "translator", col: "translator", label: "Übersetzer:in", type: "text" },
    ],
  },
];

export function resourceBySlug(slug: string): ResourceConfig | undefined {
  return RESOURCES.find((r) => r.slug === slug);
}

export async function listResourceRows(
  sb: SupabaseClient,
  cfg: ResourceConfig,
  limit = 200
): Promise<{ rows: Row[]; total: number | null }> {
  // Listenspalten UND Formularspalten lesen: das Bearbeiten-Formular befüllt
  // sonst nur die sichtbaren Felder. Bei redemittel wäre das fatal — ein PATCH
  // von phrase_de ohne tokens wird (zu Recht) abgelehnt, die Zeile ließe sich
  // über die Oberfläche also gar nicht ändern.
  const cols = [...new Set([...cfg.listColumns.map((c) => c.col), ...cfg.fields.map((f) => f.col)])];
  const { data, error, count } = await sb
    .from(cfg.table)
    .select(cols.join(", "), { count: "exact" })
    .order(cfg.orderBy, { ascending: true })
    .limit(limit);
  if (error) return { rows: [], total: null };
  return { rows: rows(data), total: count ?? null };
}
