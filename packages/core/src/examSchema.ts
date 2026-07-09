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

/**
 * D14 — span-anchored inline Korrektur (teacher-authored on the Bewerten page).
 * NOT a Groq-output schema — the teacher UI supplies these, so optional fields are
 * fine (contrast examGradeModelSchema above). Kept SEPARATE from the AI's
 * `korrekturen: string[]` so the shipped student exam flow is untouched. The grade
 * route additionally asserts 0 ≤ start < end ≤ len(answer_text) and
 * answer_text.slice(start,end) === quote against the SERVER-stored answer
 * (teacher-lms/04 §2.4). Mirror of @repo/types `Korrektur` — keep in sync.
 */
export const korrekturSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  quote: z.string().min(1).max(8000),
  kind: z.enum(["grammatik", "wortschatz", "struktur", "inhalt", "ausdruck"]).optional(),
  comment_de: z.string().trim().min(1).max(500),
  suggestion_de: z.string().trim().max(500).optional(),
});
export type KorrekturInput = z.infer<typeof korrekturSchema>;
