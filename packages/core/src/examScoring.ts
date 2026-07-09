import type {
  AufgabeNr,
  CriterionBand,
  CriterionKey,
  ExamGrade,
  ExamTask,
} from "@repo/types";
import { CRITERION_LABEL } from "@repo/types";
import type { ExamGradeModel } from "./examSchema";

/**
 * ════════════════════════════════════════════════════════════════════════
 *  OFFIZIELLES NOTENSCHEMA (Goethe-Zertifikat B1 · Schreiben, Antwortblatt)
 * ════════════════════════════════════════════════════════════════════════
 *  Punkte je Band (A–E), abhängig von Aufgabe (Teil) und Kriterium.
 *  Das Modell vergibt nur das Band; die Punkte werden hier berechnet.
 *
 *  Teil 1 & Teil 2: jedes Kriterium  A=10  B=7,5  C=5  D=2,5  E=0   → 40 / Teil
 *  Teil 3: Erfüllung & Kohärenz      A=4   B=3    C=2  D=1    E=0   → je 4
 *          Wortschatz & Strukturen   A=6   B=4,5  C=3  D=1,5  E=0   → je 6  → 20
 *  Gesamt über alle drei Teile = 100. Bestanden ab 60 %.
 * ════════════════════════════════════════════════════════════════════════
 */
type BandPoints = Record<CriterionBand, number>;

const SCALE_10: BandPoints = { A: 10, B: 7.5, C: 5, D: 2.5, E: 0 };
const SCALE_4: BandPoints = { A: 4, B: 3, C: 2, D: 1, E: 0 };
const SCALE_6: BandPoints = { A: 6, B: 4.5, C: 3, D: 1.5, E: 0 };

export const PASS_RATIO = 0.6;

export function scaleFor(aufgabe: AufgabeNr, key: CriterionKey): BandPoints {
  if (aufgabe === 3) {
    if (key === "erfuellung" || key === "kohaerenz") return SCALE_4;
    return SCALE_6; // wortschatz, strukturen
  }
  return SCALE_10; // Teil 1 & 2
}

export function criterionPoints(
  aufgabe: AufgabeNr,
  key: CriterionKey,
  band: CriterionBand
): { punkte: number; maxPunkte: number } {
  const scale = scaleFor(aufgabe, key);
  return { punkte: scale[band], maxPunkte: scale.A };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Kanonische Reihenfolge der vier Schreiben-Kriterien (Punkte-Neuberechnung). */
export const WRITING_CRITERION_KEYS: CriterionKey[] = [
  "erfuellung",
  "kohaerenz",
  "wortschatz",
  "strukturen",
];

export interface RecomputedCriterion {
  key: CriterionKey;
  band: CriterionBand;
  punkte: number;
  maxPunkte: number;
}
export interface RecomputedGrade {
  criteria: RecomputedCriterion[];
  gesamtpunkte: number;
  maxPunkte: number;
  bestanden: boolean;
}

/**
 * Rechnet aus den (Lehrer- oder Modell-)Bändern die Punkte SERVERSEITIG neu —
 * die einzige vertrauenswürdige Quelle für gesamtpunkte/max_punkte/bestanden
 * (teacher-lms/04 §2 Invariante 2). Der Klient liefert NIE eine Punktzahl; die
 * Skala kommt aus der aufgelösten `aufgabe` (Korpus 1|2|3 / Custom 2). Nur
 * Schreiben (4 Kriterien) — Sprechen (5. Kriterium `aussprache`) wird in Phase 3
 * mit der dann geklärten Punkteskala ergänzt.
 */
export function pointsFromBands(
  aufgabe: AufgabeNr,
  bands: Record<CriterionKey, CriterionBand>
): RecomputedGrade {
  const criteria = WRITING_CRITERION_KEYS.map((key) => {
    const { punkte, maxPunkte } = criterionPoints(aufgabe, key, bands[key]);
    return { key, band: bands[key], punkte, maxPunkte };
  });
  const gesamtpunkte = round1(criteria.reduce((s, c) => s + c.punkte, 0));
  const maxPunkte = criteria.reduce((s, c) => s + c.maxPunkte, 0);
  const bestanden = gesamtpunkte >= PASS_RATIO * maxPunkte;
  return { criteria, gesamtpunkte, maxPunkte, bestanden };
}

/** Baut aus den Modell-Bändern die vollständige, punktierte Bewertung. */
export function buildGrade(task: ExamTask, model: ExamGradeModel): ExamGrade {
  const criteria = model.criteria.map((c) => {
    const { punkte, maxPunkte } = criterionPoints(task.aufgabe, c.key, c.band);
    return {
      key: c.key,
      labelDe: CRITERION_LABEL[c.key],
      band: c.band,
      punkte,
      maxPunkte,
      begruendungDe: c.begruendungDe,
    };
  });

  const gesamtpunkte = round1(
    criteria.reduce((sum, c) => sum + c.punkte, 0)
  );
  const maxPunkte = criteria.reduce((sum, c) => sum + c.maxPunkte, 0);
  const bestanden = gesamtpunkte >= PASS_RATIO * maxPunkte;

  return {
    aufgabe: task.aufgabe,
    criteria,
    gesamtpunkte,
    maxPunkte,
    bestanden,
    summaryDe: model.summaryDe,
    korrekturen: model.korrekturen,
  };
}

const BANDS: CriterionBand[] = ["A", "B", "C", "D", "E"];

/** Nächstgelegenes Band zu einer (gemittelten) Punktzahl; bei Gleichstand das höhere. */
function nearestBand(points: number, scale: BandPoints): CriterionBand {
  let best: CriterionBand = "A";
  let bestDist = Infinity;
  for (const b of BANDS) {
    const d = Math.abs(scale[b] - points);
    if (d < bestDist) {
      bestDist = d;
      best = b; // A→E durchlaufen, strikt '<' ⇒ bei Gleichstand bleibt das höhere Band
    }
  }
  return best;
}

/**
 * Führt mehrere unabhängige Bewertungen nach dem offiziellen Verfahren zusammen:
 * je Kriterium das arithmetische Mittel der Punkte; das textliche Feedback
 * (Begründungen, Rückmeldung, Korrekturen) stammt aus der LETZTEN Bewertung
 * (i. d. R. die strenge bzw. — bei Drittbewertung — die entscheidende).
 */
export function reconcileGrades(task: ExamTask, grades: ExamGrade[]): ExamGrade {
  const keys = grades[0].criteria.map((c) => c.key);
  const last = grades[grades.length - 1];

  const criteria = keys.map((key) => {
    const cs = grades.map(
      (g) => g.criteria.find((c) => c.key === key) ?? g.criteria[0]
    );
    const avg = round1(cs.reduce((s, c) => s + c.punkte, 0) / cs.length);
    const scale = scaleFor(task.aufgabe, key);
    const main = last.criteria.find((c) => c.key === key) ?? cs[cs.length - 1];
    return {
      key,
      labelDe: CRITERION_LABEL[key],
      band: nearestBand(avg, scale),
      punkte: avg,
      maxPunkte: scale.A,
      begruendungDe: main.begruendungDe,
    };
  });

  const gesamtpunkte = round1(criteria.reduce((s, c) => s + c.punkte, 0));
  const maxPunkte = criteria.reduce((s, c) => s + c.maxPunkte, 0);
  const bestanden = gesamtpunkte >= PASS_RATIO * maxPunkte;

  return {
    aufgabe: task.aufgabe,
    criteria,
    gesamtpunkte,
    maxPunkte,
    bestanden,
    summaryDe: last.summaryDe,
    korrekturen: last.korrekturen,
  };
}
