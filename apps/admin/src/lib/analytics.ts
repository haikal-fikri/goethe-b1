import type { SupabaseClient } from "@supabase/supabase-js";

// Von allem, was die Analytics-Comp zeigt, ist genau EINE Kennzahl aus der DB
// belegbar: die Zahl der Bewertungen pro Woche. WAU/MAU, Aktivierungs-Funnel,
// Prüfungsbereitschaft und Logo-Retention bräuchten Ereignis-/Sitzungsdaten,
// die nirgends erfasst werden — dafür steht auf dem Screen ein Leerzustand.
//
// Gezählt wird `graded_at` (wann bewertet wurde), nicht created_at: die
// Kennzahl beschreibt Bewertungsaufkommen, nicht Zeilenanlage.

const WOCHEN = 8;
const TAG_MS = 86_400_000;

export interface WochenBalken {
  /** ISO-Datum des Wochenmontags (UTC) — stabiler Schlüssel. */
  woche: string;
  label: string;
  schreiben: number;
  sprechen: number;
  pruefung: number;
  gesamt: number;
}

export interface AnalyticsData {
  balken: WochenBalken[];
  gesamt: number;
  /** true nur, wenn ALLE Quellen gelesen wurden — sonst sind die Summen unvollständig. */
  lesbar: boolean;
  /** Tabellen, die nicht gelesen werden konnten (RLS/Fehler) — ehrlich benennen. */
  fehlend: string[];
  /** true, wenn PostgREST die Zeilen abgeschnitten hat: die Zahlen sind dann zu klein. */
  abgeschnitten: boolean;
}

/**
 * PostgREST deckelt Ergebnismengen serverseitig (`db-max-rows`, gehostet
 * standardmäßig 1000) — ohne Fehler und ohne Hinweis. Wird der Deckel erreicht,
 * ist das Diagramm zu niedrig und sieht trotzdem plausibel aus. Deshalb wird
 * die Grenze erfragt und der Fall gemeldet statt still unterschlagen.
 */
const ZEILEN_DECKEL = 1000;

/** Montag (UTC) der Woche, in der `d` liegt. */
function wochenStart(d: Date): Date {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const tag = t.getUTCDay() || 7; // Mo=1 … So=7
  t.setUTCDate(t.getUTCDate() - (tag - 1));
  return t;
}

/** ISO-8601-Kalenderwoche (Woche mit dem ersten Donnerstag). */
function isoWoche(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const tag = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - tag);
  const jahresStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - jahresStart) / TAG_MS + 1) / 7);
}

type Row = Record<string, unknown>;
const rows = (d: unknown): Row[] => (Array.isArray(d) ? (d as Row[]) : []);

export async function getAnalyticsData(sb: SupabaseClient, jetzt = new Date()): Promise<AnalyticsData> {
  const dieseWoche = wochenStart(jetzt);
  const ab = new Date(dieseWoche.getTime() - (WOCHEN - 1) * 7 * TAG_MS);
  const abIso = ab.toISOString();

  const [schreiben, sprechen, pruefung] = await Promise.all([
    sb.from("assignment_grades").select("graded_at").gte("graded_at", abIso),
    sb.from("speaking_grades").select("graded_at").gte("graded_at", abIso),
    sb.from("exam_results").select("graded_at").gte("graded_at", abIso),
  ]);

  const fehlend: string[] = [];
  if (schreiben.error) fehlend.push("Schreiben-Bewertungen");
  if (sprechen.error) fehlend.push("Sprechen-Bewertungen");
  if (pruefung.error) fehlend.push("Prüfungssimulationen");

  const abgeschnitten = [schreiben.data, sprechen.data, pruefung.data].some(
    (d) => rows(d).length >= ZEILEN_DECKEL
  );

  // Leere Wochen müssen als 0 im Diagramm stehen, nicht fehlen.
  const eimer = new Map<string, WochenBalken>();
  for (let i = WOCHEN - 1; i >= 0; i--) {
    const start = new Date(dieseWoche.getTime() - i * 7 * TAG_MS);
    const key = start.toISOString().slice(0, 10);
    eimer.set(key, {
      woche: key,
      label: `KW ${isoWoche(start)}`,
      schreiben: 0,
      sprechen: 0,
      pruefung: 0,
      gesamt: 0,
    });
  }

  const zaehle = (data: unknown, feld: "schreiben" | "sprechen" | "pruefung") => {
    for (const r of rows(data)) {
      const iso = typeof r.graded_at === "string" ? r.graded_at : null;
      if (!iso) continue;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) continue;
      const key = wochenStart(d).toISOString().slice(0, 10);
      const b = eimer.get(key);
      if (!b) continue; // außerhalb des Fensters
      b[feld] += 1;
      b.gesamt += 1;
    }
  };
  zaehle(schreiben.data, "schreiben");
  zaehle(sprechen.data, "sprechen");
  zaehle(pruefung.data, "pruefung");

  const balken = [...eimer.values()];
  return {
    balken,
    gesamt: balken.reduce((s, b) => s + b.gesamt, 0),
    // Streng: schon EINE fehlende Quelle macht die Summen falsch. Eine Zahl,
    // der 30 % fehlen, ist schlimmer als ein „—".
    lesbar: fehlend.length === 0,
    fehlend,
    abgeschnitten,
  };
}
