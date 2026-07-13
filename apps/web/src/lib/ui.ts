import type { CEFRLevel, SkillCode } from "@/types";
import type { Tone } from "@/components/ui/primitives";

// Semantische Zuordnungen des Designsystems. Alle Werte zeigen auf
// SEMANTISCHE Tokens (globals.css) — nie auf rohe Hex-Werte.

/** GER-Niveaus behalten ihre Farbcodierung (1:1 aus dem Lehrkraft-Portal). */
export const LEVEL_COLOR: Record<CEFRLevel, string> = {
  B1: "var(--cefr-b1)",
  B2: "var(--cefr-b2)",
  C1: "var(--cefr-c1)",
  C2: "var(--cefr-c2)",
};

// Schreiben = grün, Sprechen = blau (wie SkillTile im Lehrkraft-Portal).
// Konnektoren = lila — der dritte On-System-Akzent; das LMS kennt nur zwei Skills.
export const SKILL_ACCENT: Record<SkillCode, string> = {
  schreiben: "var(--gruen)",
  sprechen: "var(--blau)",
  shared: "var(--lila)",
};

export const SKILL_TINT: Record<SkillCode, string> = {
  schreiben: "var(--gruen-tint)",
  sprechen: "var(--blau-tint)",
  shared: "var(--lila-tint)",
};

export const SKILL_TONE: Record<SkillCode, Tone> = {
  schreiben: "gruen",
  sprechen: "blau",
  shared: "lila",
};

export const SKILL_LABEL: Record<SkillCode, string> = {
  schreiben: "Schreiben",
  sprechen: "Sprechen",
  shared: "Konnektoren",
};

/**
 * Vordergrundfarbe auf einer gesättigten Akzentfläche.
 * NIEMALS var(--bg) verwenden: das funktionierte nur, solange --bg reines
 * Schwarz/Weiß war. Auf der Papier-Palette ergäbe es im Dark-Theme
 * fast-schwarze Schrift auf grünem Grund.
 */
export const ON_ACCENT = "#fff";
