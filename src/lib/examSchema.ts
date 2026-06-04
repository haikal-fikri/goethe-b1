import { z } from "zod";

/**
 * Was das Modell zurückgibt: nur Band (A–E) + Begründung je Kriterium sowie
 * Gesamtrückmeldung und Korrekturen. Die Punkte werden in src/lib/examScoring.ts
 * aus dem offiziellen Notenschema berechnet (nicht vom Modell).
 *
 * Hinweis: Groq strict json_schema verlangt ALLE Felder in `required` — daher
 * keine optionalen Zod-Felder. (korrekturen ggf. leeres Array.)
 */
export const criterionModelSchema = z.object({
  key: z.enum(["erfuellung", "kohaerenz", "wortschatz", "strukturen"]),
  band: z.enum(["A", "B", "C", "D", "E"]),
  begruendungDe: z.string(),
});

export const examGradeModelSchema = z.object({
  criteria: z.array(criterionModelSchema).length(4),
  summaryDe: z.string(),
  korrekturen: z.array(z.string()),
});

export type ExamGradeModel = z.infer<typeof examGradeModelSchema>;
