import "server-only";
import { createGroq } from "@ai-sdk/groq";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import {
  buildExamMessages,
  buildGrade,
  reconcileGrades,
  PASS_RATIO,
  examGradeModelSchema,
  MODEL_ID,
  type ExaminerPersona,
} from "@repo/core";
import type { ExamGrade, ExamTask } from "@repo/types";

// Vier-Augen-Schreiben-Grader — DIESELBE Pipeline wie apps/web /api/exam/grade
// (mild ∥ streng → Straddle-Test → optional tiebreak → reconcileGrades), nur
// NICHT gestreamt: das Ergebnis wird als assignment_ai_recommendations.recommended
// gespeichert (teacher-only). MODEL_ID = openai/gpt-oss-120b. Punkte kommen aus
// buildGrade (Bänder→Skala der aufgelösten aufgabe) — nie vom Client.

async function gradeWith(
  model: ReturnType<ReturnType<typeof createGroq>>,
  task: ExamTask,
  answer: string,
  persona: ExaminerPersona
): Promise<ExamGrade> {
  const { system, prompt } = buildExamMessages(task, answer, persona);
  const call = (extraSystem = "") =>
    generateText({
      model,
      system: system + extraSystem,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 4000,
      maxRetries: 3,
      providerOptions: { groq: { reasoningEffort: "low", reasoningFormat: "hidden" } },
      output: Output.object({ schema: examGradeModelSchema }),
    });
  try {
    const { output } = await call();
    return buildGrade(task, output);
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) {
      const { output } = await call(
        "\n\nWICHTIG: Antworte AUSSCHLIESSLICH mit gültigem JSON gemäß dem Schema. " +
          "Kein Markdown, keine Code-Block-Zeichen, kein Text davor oder danach."
      );
      return buildGrade(task, output);
    }
    throw e;
  }
}

export interface WritingRecommendation {
  recommended: ExamGrade;
  thirdUsed: boolean;
}

/** Läuft die Vier-Augen-Bewertung synchron und liefert die reconciled Empfehlung. */
export async function gradeWritingVierAugen(
  task: ExamTask,
  answer: string
): Promise<WritingRecommendation> {
  const model = createGroq()(MODEL_ID);
  const [mild, streng] = await Promise.all([
    gradeWith(model, task, answer, "mild"),
    gradeWith(model, task, answer, "streng"),
  ]);

  const passLine = PASS_RATIO * mild.maxPunkte;
  const mean = (mild.gesamtpunkte + streng.gesamtpunkte) / 2;
  const straddle = mild.bestanden !== streng.bestanden && mean < passLine;

  if (straddle) {
    const third = await gradeWith(model, task, answer, "tiebreak");
    const sameSide = third.bestanden === mild.bestanden ? mild : streng;
    return { recommended: reconcileGrades(task, [sameSide, third]), thirdUsed: true };
  }
  return { recommended: reconcileGrades(task, [mild, streng]), thirdUsed: false };
}
