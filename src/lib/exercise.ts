import type { RedemittelItem } from "@/types";

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
