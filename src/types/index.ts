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
