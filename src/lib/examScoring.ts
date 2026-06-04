import type {
  AufgabeNr,
  CriterionBand,
  CriterionKey,
  ExamGrade,
  ExamTask,
} from "@/types";
import { CRITERION_LABEL } from "@/types";
import type { ExamGradeModel } from "@/lib/examSchema";

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

function scaleFor(aufgabe: AufgabeNr, key: CriterionKey): BandPoints {
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

const round1 = (n: number) => Math.round(n * 10) / 10;

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
