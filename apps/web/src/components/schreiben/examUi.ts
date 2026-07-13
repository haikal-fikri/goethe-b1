import type { CriterionBand } from "@/types";

// Gemeinsame Anzeige-Bausteine der Prüfungs-Oberfläche.
// Schreiben ist grün (wie SkillTile im Lehrkraft-Portal).

export type Status = "idle" | "loading" | "done" | "error";

export const ACCENT = "var(--gruen)";

/**
 * Band → Farbe. Dreistufig wie im Lehrkraft-Portal (CriterionBands), nicht
 * zweistufig: C ist „knapp" (gold), nicht einfach „schlecht".
 */
export const BAND_COLOR: Record<CriterionBand, string> = {
  A: "var(--gruen)",
  B: "var(--gruen)",
  C: "var(--gold-text)",
  D: "var(--rot-text)",
  E: "var(--rot-text)",
};

/** Bestehen-Status nach Prozent — identische Schwellen wie ScoreSummary im LMS. */
export function statusOf(pct: number): {
  label: string;
  color: string;
  tint: string;
} {
  if (pct >= 60)
    return { label: "Bestanden", color: "var(--gruen)", tint: "var(--gruen-tint)" };
  if (pct >= 50)
    return { label: "Knapp", color: "var(--gold-text)", tint: "var(--gold-tint)" };
  return {
    label: "Nicht bestanden",
    color: "var(--rot-text)",
    tint: "var(--rot-tint)",
  };
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

/** Punkte mit deutschem Dezimalkomma, z.B. 7.5 → "7,5". */
export function fmtPunkte(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
