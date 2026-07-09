export type CEFRLevel = "B1" | "B2" | "C1" | "C2";
export type SkillCode = "schreiben" | "sprechen" | "shared";

export interface TaskRef {
  code: string; // z.B. "schreiben_a2"
  labelDe: string;
  labelEn: string;
}

export interface FunctionRef {
  code: string; // z.B. "meinung_aeussern"
  nameDe: string;
  nameEn: string;
}

export interface Example {
  de: string; // Beispielsatz, der die Wendung im Kontext realisiert
  en?: string; // Übersetzung (aus redemittel_translation überlagert; Fallback Englisch)
  row_id?: string; // id der Beispiel-Kindzeile (redemittel_item aggregiert; für den Übersetzungs-Overlay)
}

export interface RedemittelItem {
  id: string;
  phrase: string; // voller deutscher Satz (== tokens.join(" "))
  frame: string | null;
  translation: string; // englischer Prompt
  level: CEFRLevel;
  skill: SkillCode;
  task: TaskRef;
  function: FunctionRef;
  registerGroup: string | null;
  tokens: string[]; // kanonische Reihenfolge = Lösungsschlüssel
  distractors: string[];
  clozeTemplate: string | null;
  notes: string | null;
  tags: string[];
  difficulty: number; // 1..5
  examples: Example[]; // 1–2 kontextualisierte Beispielsätze (kann leer sein)
}

export const LEVELS: CEFRLevel[] = ["B1", "B2", "C1", "C2"];
export const LEVEL_RANK: Record<CEFRLevel, number> = {
  B1: 1,
  B2: 2,
  C1: 3,
  C2: 4,
};

export const SKILL_LABEL: Record<SkillCode, string> = {
  schreiben: "Schreiben",
  sprechen: "Sprechen",
  shared: "Konnektoren",
};

// --- Prüfung (KI-Prüfer Schreiben) ---

export type AufgabeNr = 1 | 2 | 3;

export interface ExamTask {
  id: string; // z.B. "s1-a1"
  simulation: number; // 1..4
  aufgabe: AufgabeNr;
  taskType: string; // z.B. "Persönliche E-Mail"
  titleDe: string;
  promptDe: string; // Aufgabentext, den der/die Kandidat:in liest
  bulletPointsDe?: string[]; // Leitpunkte
  minWords: number; // Wortvorgabe (Richtwert)
  recommendedMinutes?: number;
  sampleAnswerDe?: string; // Beispieltext / Musterlösung
}

export interface ExamSimulation {
  id: number;
  titleDe: string;
  tasks: ExamTask[]; // 3 Aufgaben
}

export type CriterionBand = "A" | "B" | "C" | "D" | "E";
export type CriterionKey =
  | "erfuellung"
  | "kohaerenz"
  | "wortschatz"
  | "strukturen";

export interface CriterionEvaluation {
  key: CriterionKey;
  labelDe: string;
  band: CriterionBand;
  punkte: number;
  maxPunkte: number;
  begruendungDe: string;
}

export interface ExamGrade {
  aufgabe: AufgabeNr;
  criteria: CriterionEvaluation[]; // genau 4
  gesamtpunkte: number;
  maxPunkte: number;
  bestanden: boolean;
  summaryDe: string;
  korrekturen?: string[];
}

/**
 * D14 — span-anchored inline Korrektur (teacher-authored on the Bewerten page).
 * DELIBERATELY separate from ExamGrade.korrekturen (the AI's free-text string[],
 * kept untouched so the shipped student exam flow + Groq strict json_schema are
 * unaffected). Persisted in assignment_grades.final.inlineKorrekturen (jsonb, no
 * migration); the grade route validates offsets against the server-stored
 * answer_text (teacher-lms/04 §2.4, /02 §5.4). Mirror of @repo/core
 * `korrekturSchema` — keep the two in sync.
 */
export interface Korrektur {
  start: number; // UTF-16 offset into answer_text where the highlight begins (inclusive)
  end: number; // offset where it ends (exclusive) → 0 ≤ start < end ≤ answer_text.length
  quote: string; // the selected substring — must equal answer_text.slice(start,end)
  kind?: "grammatik" | "wortschatz" | "struktur" | "inhalt" | "ausdruck";
  comment_de: string; // teacher's note, ≤ 500
  suggestion_de?: string; // optional corrected form
}

/** Teacher subscription plan derived from the Polar product (entitlements.plan; teacher-lms/02 §1.1). */
export type TeacherPlan = "starter" | "pro";

export const CRITERION_LABEL: Record<CriterionKey, string> = {
  erfuellung: "Erfüllung",
  kohaerenz: "Kohärenz",
  wortschatz: "Wortschatz",
  strukturen: "Strukturen",
};

// --- Vier-Augen-Prinzip (zwei/drei Bewertende) ---

export type ExaminerLabel = "mild" | "streng" | "konsens";

export const EXAMINER_LABEL_DE: Record<ExaminerLabel, string> = {
  mild: "Prüfer A · mild",
  streng: "Prüfer B · streng",
  konsens: "Prüfer C · Drittbewertung",
};

export interface ExaminerResult {
  label: ExaminerLabel;
  grade: ExamGrade;
}

/** Ergebnis des KI-Prüfers: zusammengeführte Bewertung + einzelne Bewertende. */
export interface ExamResult {
  reconciled: ExamGrade; // arithmetisches Mittel (offizielles Verfahren)
  examiners: ExaminerResult[]; // [mild, streng] (+ konsens bei Drittbewertung)
  thirdUsed: boolean;
}

// --- Persistenz (additive Tabellen 0005–0009) ---
export * from "./persistence";
