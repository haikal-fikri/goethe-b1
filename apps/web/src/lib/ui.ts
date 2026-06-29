import type { CEFRLevel, SkillCode } from "@/types";

export const LEVEL_COLOR: Record<CEFRLevel, string> = {
  B1: "var(--level-b1)",
  B2: "var(--level-b2)",
  C1: "var(--level-c1)",
  C2: "var(--level-c2)",
};

export const SKILL_ACCENT: Record<SkillCode, string> = {
  schreiben: "var(--accent-write)",
  sprechen: "var(--accent-speak)",
  shared: "var(--accent-shared)",
};

export const SKILL_LABEL: Record<SkillCode, string> = {
  schreiben: "Schreiben",
  sprechen: "Sprechen",
  shared: "Konnektoren",
};
