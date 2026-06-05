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
        // Etwas mehr Widerstandsfähigkeit gegen kurzzeitige Groq-Aussetzer/Rate-Limits
        // (zwei Bewertungen laufen parallel).
        maxRetries: 3,
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

  // NDJSON-Stream: ein JSON-Ereignis pro Zeile, damit der Client den
  // Fortschritt der beiden Bewertungen in Echtzeit anzeigen kann.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) =>
        controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      try {
        send({ type: "start" });

        // Zwei Bewertende bewerten unabhängig (parallel); jedes meldet sich,
        // sobald es fertig ist.
        const examiners: ExaminerResult[] = [];
        const [mild, streng] = await Promise.all([
          gradeWith("mild").then((g) => {
            send({ type: "examiner", label: "mild" });
            return g;
          }),
          gradeWith("streng").then((g) => {
            send({ type: "examiner", label: "streng" });
            return g;
          }),
        ]);
        examiners.push({ label: "mild", grade: mild }, { label: "streng", grade: streng });

        // Drittbewertung NUR bei Uneinigkeit über die Bestehensgrenze
        // (offizielles Verfahren).
        const passLine = PASS_RATIO * mild.maxPunkte;
        const mean = (mild.gesamtpunkte + streng.gesamtpunkte) / 2;
        const straddle = mild.bestanden !== streng.bestanden && mean < passLine;

        let reconciled: ExamGrade;
        let thirdUsed = false;

        if (straddle) {
          send({ type: "third" });
          const third = await gradeWith("tiebreak");
          thirdUsed = true;
          examiners.push({ label: "konsens", grade: third });
          const sameSide = third.bestanden === mild.bestanden ? mild : streng;
          reconciled = reconcileGrades(task, [sameSide, third]);
        } else {
          reconciled = reconcileGrades(task, [mild, streng]);
        }

        // `grade` bleibt die zusammengeführte Bewertung (rückwärtskompatibel).
        send({ type: "done", grade: reconciled, examiners, thirdUsed });
      } catch (err) {
        console.error("[exam/grade] Fehler:", err);
        send({
          type: "error",
          error:
            "Die Bewertung konnte nicht erstellt werden. Bitte versuche es erneut.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
