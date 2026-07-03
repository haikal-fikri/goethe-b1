import type { RedemittelItem } from "@repo/types";

export interface Tile {
  id: string;
  label: string;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wortbank-Kacheln für ein Item: Tokens + Distraktoren, gemischt, mit stabilen IDs */
export function buildTiles(item: RedemittelItem): Tile[] {
  const tokens: Tile[] = item.tokens.map((label, i) => ({
    id: `t${i}`,
    label,
  }));
  const distractors: Tile[] = item.distractors.map((label, i) => ({
    id: `d${i}`,
    label,
  }));
  return shuffle([...tokens, ...distractors]);
}

export function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Stable, deterministic exercise kind for an item (BUG-6): every seed item has BOTH
 * `tokens` and a `cloze_template`, so kind is a *presentation* choice, not a data property.
 * Hash the last hex nibble of the (12-hex) id: even → word-bank, odd → cloze (~50/50, stable
 * per item). Non-hex ids (test fixtures) → cloze (parseInt→NaN fallback). MUST stay byte-identical
 * to the SQL mirror in `start_set()` (0010_gamification.sql) so a set's kinds match server-side.
 */
export function pickExerciseKind(id: string): "wordbank" | "cloze" {
  const n = parseInt(id.slice(-1), 16);
  return Number.isFinite(n) && n % 2 === 0 ? "wordbank" : "cloze";
}
