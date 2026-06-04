import type { RedemittelItem } from "@/types";
import { shuffle, type Tile } from "@/lib/exercise";

export type ClozePart =
  | { kind: "text"; value: string }
  | { kind: "blank"; answer: string; index: number };

const BLANK_RE = /\{\{(.+?)\}\}/g;

/**
 * Zerlegt ein clozeTemplate (z.B. "{{Da}} es spät war, …") in eine geordnete
 * Folge aus Text- und Lücken-Teilen. Die Lücken-Antwort behält ihre Satzzeichen
 * exakt (z.B. "recht.", "Vielen"), damit der Vergleich mit den Pills stimmt.
 */
export function parseCloze(template: string): ClozePart[] {
  const parts: ClozePart[] = [];
  let last = 0;
  let index = 0;
  for (const m of template.matchAll(BLANK_RE)) {
    const start = m.index ?? 0;
    if (start > last) {
      parts.push({ kind: "text", value: template.slice(last, start) });
    }
    parts.push({ kind: "blank", answer: m[1], index: index++ });
    last = start + m[0].length;
  }
  if (last < template.length) {
    parts.push({ kind: "text", value: template.slice(last) });
  }
  return parts;
}

/** Nur die Lücken (in Reihenfolge) — der Lösungsschlüssel. */
export function clozeBlanks(template: string): string[] {
  return parseCloze(template)
    .filter((p): p is Extract<ClozePart, { kind: "blank" }> => p.kind === "blank")
    .map((p) => p.answer);
}

/**
 * Pills für eine Lücken-Übung: die gesuchten Wörter + Distraktoren, gemischt,
 * mit stabilen IDs. Gleiche Form wie die Wortbank-Kacheln ({ id, label }).
 */
export function buildClozePills(item: RedemittelItem): Tile[] {
  const answers: Tile[] = clozeBlanks(item.clozeTemplate ?? "").map((label, i) => ({
    id: `b${i}`,
    label,
  }));
  const distractors: Tile[] = item.distractors.map((label, i) => ({
    id: `d${i}`,
    label,
  }));
  return shuffle([...answers, ...distractors]);
}
