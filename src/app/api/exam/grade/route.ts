import { createGroq } from "@ai-sdk/groq";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { examGradeModelSchema } from "@/lib/examSchema";
import { buildExamMessages } from "@/lib/examPrompt";
import { buildGrade } from "@/lib/examScoring";
import { getExamTask } from "@/lib/exam";

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
  const { system, prompt } = buildExamMessages(task, answer);

  const callOnce = (extraSystem = "") =>
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
    const { output } = await callOnce();
    return Response.json({ grade: buildGrade(task, output) });
  } catch (err) {
    // Ein strengerer Reparaturversuch, falls das Modell kein gültiges JSON lieferte.
    if (NoObjectGeneratedError.isInstance(err)) {
      try {
        const { output } = await callOnce(
          "\n\nWICHTIG: Antworte AUSSCHLIESSLICH mit gültigem JSON gemäß dem Schema. " +
            "Kein Markdown, keine Code-Block-Zeichen, kein Text davor oder danach."
        );
        return Response.json({ grade: buildGrade(task, output) });
      } catch {
        return Response.json(
          {
            error:
              "Die Bewertung konnte nicht erstellt werden. Bitte versuche es erneut.",
          },
          { status: 502 }
        );
      }
    }
    console.error("[exam/grade] Unerwarteter Fehler:", err);
    return Response.json(
      { error: "Unerwarteter Fehler bei der Bewertung." },
      { status: 500 }
    );
  }
}
