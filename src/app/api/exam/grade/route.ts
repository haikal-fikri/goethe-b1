import { createGroq } from "@ai-sdk/groq";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { examGradeModelSchema } from "@/lib/examSchema";
import { buildExamMessages, type ExaminerPersona } from "@/lib/examPrompt";
import { buildGrade, reconcileGrades, PASS_RATIO } from "@/lib/examScoring";
import { getExamTask } from "@/lib/exam";
import type { ExamGrade, ExaminerResult } from "@/types";

// Open-Source-Modell auf Groq. Für stärkeres Deutsch ggf. tauschen, z.B.
// "openai/gpt-oss-20b" (leichter) oder "llama-3.3-70b-versatile".
const MODEL_ID = "openai/gpt-oss-120b";

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: "GROQ_API_KEY ist nicht gesetzt." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { taskId, answer } = (body ?? {}) as {
    taskId?: string;
    answer?: string;
  };

  const task = taskId ? await getExamTask(taskId) : undefined;
  if (!task) {
    return Response.json({ error: "Unbekannte Aufgabe." }, { status: 400 });
  }
  if (typeof answer !== "string" || answer.trim().length < 20) {
    return Response.json(
      { error: "Dein Text ist zu kurz für eine Bewertung." },
      { status: 400 }
    );
  }

  const model = createGroq()(MODEL_ID);

  // Eine Bewertung durch eine Prüfer-Rolle (mit einem Reparaturversuch bei ungültigem JSON).
  const gradeWith = async (persona: ExaminerPersona): Promise<ExamGrade> => {
    const { system, prompt } = buildExamMessages(task, answer, persona);
    const call = (extraSystem = "") =>
      generateText({
        model,
        system: system + extraSystem,
        prompt,
        temperature: 0.2,
        // gpt-oss ist ein Reasoning-Modell; genug Budget, damit das JSON vollständig wird.
        maxOutputTokens: 4000,
        maxRetries: 1,
        providerOptions: {
          groq: { reasoningEffort: "low", reasoningFormat: "hidden" },
        },
        output: Output.object({ schema: examGradeModelSchema }),
      });
    try {
      const { output } = await call();
      return buildGrade(task, output);
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        const { output } = await call(
          "\n\nWICHTIG: Antworte AUSSCHLIESSLICH mit gültigem JSON gemäß dem Schema. " +
            "Kein Markdown, keine Code-Block-Zeichen, kein Text davor oder danach."
        );
        return buildGrade(task, output);
      }
      throw err;
    }
  };

  try {
    // Vier-Augen-Prinzip: zwei Bewertende bewerten unabhängig (parallel).
    const [mild, streng] = await Promise.all([
      gradeWith("mild"),
      gradeWith("streng"),
    ]);

    const examiners: ExaminerResult[] = [
      { label: "mild", grade: mild },
      { label: "streng", grade: streng },
    ];

    // Drittbewertung NUR, wenn die beiden über die Bestehensgrenze uneinig sind
    // und das Mittel unter der Grenze liegt (offizielles Verfahren).
    const passLine = PASS_RATIO * mild.maxPunkte;
    const mean = (mild.gesamtpunkte + streng.gesamtpunkte) / 2;
    const straddle = mild.bestanden !== streng.bestanden && mean < passLine;

    let reconciled: ExamGrade;
    let thirdUsed = false;

    if (straddle) {
      const third = await gradeWith("tiebreak");
      thirdUsed = true;
      examiners.push({ label: "konsens", grade: third });
      // Die Drittbewertung gibt den Ausschlag: Endergebnis = Mittel aus
      // Drittbewertung und der gleichseitigen (bestanden/nicht bestanden) Bewertung.
      const sameSide = third.bestanden === mild.bestanden ? mild : streng;
      reconciled = reconcileGrades(task, [sameSide, third]);
    } else {
      reconciled = reconcileGrades(task, [mild, streng]);
    }

    // `grade` bleibt die zusammengeführte Bewertung (rückwärtskompatibel).
    return Response.json({ grade: reconciled, examiners, thirdUsed });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      return Response.json(
        {
          error:
            "Die Bewertung konnte nicht erstellt werden. Bitte versuche es erneut.",
        },
        { status: 502 }
      );
    }
    console.error("[exam/grade] Unerwarteter Fehler:", err);
    return Response.json(
      { error: "Unerwarteter Fehler bei der Bewertung." },
      { status: 500 }
    );
  }
}
