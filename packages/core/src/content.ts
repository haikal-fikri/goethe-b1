import type {
  CEFRLevel,
  RedemittelItem,
  SkillCode,
} from "@repo/types";
import { LEVEL_RANK } from "@repo/types";

// Reine Hilfsfunktionen: die Items werden von den Server-Seiten via
// getAllItems() (src/lib/redemittel.ts, Postgres) geladen und hier übergeben.
// Diese Datei bleibt frei von DB-/server-only-Importen (sie wird auch vom
// Client-Component ReferenceBrowser importiert — nur functionRank).

const SKILL_ORDER: SkillCode[] = ["schreiben", "sprechen", "shared"];

/**
 * Kanonische Reihenfolge der Funktions-Karten pro Aufgabe/Teil — so, wie die
 * Bausteine in einem echten Aufsatz/einer E-Mail/Präsentation aufeinanderfolgen
 * (Einleitung → … → Schluss). Quelle: redemittel-goethe-b1.html.
 * Funktionen, die hier nicht gelistet sind, landen ans Ende (nach Häufigkeit).
 */
const FUNCTION_ORDER: Record<string, string[]> = {
  schreiben_a1: ["einleitung_kontakt", "danken_bedauern", "vorschlag_bitte", "schluss_fazit"],
  schreiben_a2: [
    "einleitung_kontakt",
    "meinung_aeussern",
    "zustimmen",
    "widersprechen",
    "argumentieren",
    "beispiele",
    "konzession",
    "schluss_fazit",
  ],
  schreiben_a3: ["anliegen", "absagen_entschuldigen", "vorschlag_bitte", "danken_bedauern", "schluss_fazit"],
  sprechen_t1: ["vorschlag_bitte", "zustimmen", "abwaegen", "sich_einigen"],
  sprechen_t2: ["gliedern", "uebergaenge", "erfahrung", "bewerten", "abschluss_praesentation"],
  sprechen_t3: ["rueckmeldung_lob", "nachfragen", "souveraen_antworten", "zeit_gewinnen"],
  shared_konnektoren: [
    "konnektor_grund",
    "konnektor_gegensatz",
    "konnektor_folge",
    "konnektor_einraeumung",
    "konnektor_aufzaehlung",
    "konnektor_einschraenkung",
    "konnektor_bedingung",
    "konnektor_bezug",
  ],
};

export function functionRank(taskCode: string, functionCode: string): number {
  const i = FUNCTION_ORDER[taskCode]?.indexOf(functionCode) ?? -1;
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

export interface FunctionGroup {
  functionCode: string;
  functionName: string;
  lessonId: string;
  count: number;
  /** Anzahl je Niveau — für korrekte Zähler bei aktivem Niveau-Filter */
  countByLevel: Partial<Record<CEFRLevel, number>>;
  levels: CEFRLevel[];
}

export interface TaskGroup {
  taskCode: string;
  taskLabel: string;
  functions: FunctionGroup[];
}

export interface SkillGroup {
  skill: SkillCode;
  tasks: TaskGroup[];
}

const LEVEL_SORT = (a: CEFRLevel, b: CEFRLevel) => LEVEL_RANK[a] - LEVEL_RANK[b];

/** lessonId kodiert skill + task + function */
export function makeLessonId(
  skill: SkillCode,
  taskCode: string,
  functionCode: string
): string {
  return `${skill}__${taskCode}__${functionCode}`;
}

export function parseLessonId(
  lessonId: string
): { skill: SkillCode; taskCode: string; functionCode: string } | null {
  const parts = lessonId.split("__");
  if (parts.length !== 3) return null;
  return {
    skill: parts[0] as SkillCode,
    taskCode: parts[1],
    functionCode: parts[2],
  };
}

/** Vollständiger Baum skill → task → function mit Zählern und vorhandenen Niveaus */
export function getSkillGroups(items: RedemittelItem[]): SkillGroup[] {
  const skillMap = new Map<SkillCode, Map<string, Map<string, FunctionGroup>>>();
  const taskLabels = new Map<string, string>();

  for (const item of items) {
    if (!skillMap.has(item.skill)) skillMap.set(item.skill, new Map());
    const taskMap = skillMap.get(item.skill)!;

    taskLabels.set(item.task.code, item.task.labelDe);
    if (!taskMap.has(item.task.code)) taskMap.set(item.task.code, new Map());
    const fnMap = taskMap.get(item.task.code)!;

    if (!fnMap.has(item.function.code)) {
      fnMap.set(item.function.code, {
        functionCode: item.function.code,
        functionName: item.function.nameDe,
        lessonId: makeLessonId(item.skill, item.task.code, item.function.code),
        count: 0,
        countByLevel: {},
        levels: [],
      });
    }
    const fg = fnMap.get(item.function.code)!;
    fg.count += 1;
    fg.countByLevel[item.level] = (fg.countByLevel[item.level] ?? 0) + 1;
    if (!fg.levels.includes(item.level)) fg.levels.push(item.level);
  }

  const result: SkillGroup[] = [];
  for (const skill of SKILL_ORDER) {
    const taskMap = skillMap.get(skill);
    if (!taskMap) continue;
    const tasks: TaskGroup[] = [];
    for (const [taskCode, fnMap] of taskMap) {
      const functions = [...fnMap.values()].sort(
        (a, b) =>
          functionRank(taskCode, a.functionCode) -
            functionRank(taskCode, b.functionCode) ||
          b.count - a.count ||
          a.functionName.localeCompare(b.functionName)
      );
      functions.forEach((f) => f.levels.sort(LEVEL_SORT));
      tasks.push({
        taskCode,
        taskLabel: taskLabels.get(taskCode) ?? taskCode,
        functions,
      });
    }
    tasks.sort((a, b) => a.taskCode.localeCompare(b.taskCode));
    result.push({ skill, tasks });
  }
  return result;
}

/** Items einer Lektion (task+function), optional ab einem Mindestniveau */
export function getLessonItems(
  items: RedemittelItem[],
  lessonId: string,
  minLevel: CEFRLevel = "B1"
): RedemittelItem[] {
  const parsed = parseLessonId(lessonId);
  if (!parsed) return [];
  const min = LEVEL_RANK[minLevel];
  return items.filter(
    (it) =>
      it.skill === parsed.skill &&
      it.task.code === parsed.taskCode &&
      it.function.code === parsed.functionCode &&
      LEVEL_RANK[it.level] >= min
  );
}

/**
 * R2-1 · Prüfungs-Level-bezogene Kennzahlen. „Gelernt X/Y" + Readiness messen das
 * PRÜFUNGSNIVEAU der/des Lernenden (`profile.level`), nicht das ganze Korpus. Da
 * `exercise_progress` jede geübte Wendung ALLER Niveaus speichert, „reflektiert" bereits
 * gemeisterter B2/C1/C2-Stoff automatisch, sobald die/der Lernende dieses Niveau wählt —
 * kein Backfill. Aus dem bereits geladenen Katalog abgeleitet (kein count(*)-Roundtrip).
 */
export function levelCount(items: RedemittelItem[], level: CEFRLevel): number {
  let n = 0;
  for (const it of items) if (it.level === level) n++;
  return n;
}

/** Menge der Item-IDs eines Niveaus — für „gemeistert ≤ Gesamt" (Zähler aufs Prüfungsniveau einschränken). */
export function levelIdSet(items: RedemittelItem[], level: CEFRLevel): Set<string> {
  const s = new Set<string>();
  for (const it of items) if (it.level === level) s.add(it.id);
  return s;
}

/**
 * R2-3 · Niveau-Filter für die Übungs-/Lern-Auswahl (opt-in „push yourself").
 * `exam` = nur das Prüfungsniveau (Default); `b2plus`/`c1plus` = ab B2/C1 aufwärts; `all` = alles.
 */
export type LevelScope = "exam" | "b2plus" | "c1plus" | "all";

export function inLevelScope(itemLevel: CEFRLevel, scope: LevelScope, examLevel: CEFRLevel): boolean {
  switch (scope) {
    case "exam": return itemLevel === examLevel;
    case "b2plus": return LEVEL_RANK[itemLevel] >= LEVEL_RANK.B2;
    case "c1plus": return LEVEL_RANK[itemLevel] >= LEVEL_RANK.C1;
    case "all": return true;
  }
}

export function getLessonMeta(items: RedemittelItem[], lessonId: string) {
  const parsed = parseLessonId(lessonId);
  if (!parsed) return null;
  const sample = items.find(
    (it) =>
      it.skill === parsed.skill &&
      it.task.code === parsed.taskCode &&
      it.function.code === parsed.functionCode
  );
  if (!sample) return null;
  return {
    skill: parsed.skill,
    taskLabel: sample.task.labelDe,
    functionName: sample.function.nameDe,
  };
}

export function getStats(items: RedemittelItem[]) {
  const byLevel: Record<string, number> = {};
  const bySkill: Record<string, number> = {};
  for (const it of items) {
    byLevel[it.level] = (byLevel[it.level] || 0) + 1;
    bySkill[it.skill] = (bySkill[it.skill] || 0) + 1;
  }
  return { total: items.length, byLevel, bySkill };
}
