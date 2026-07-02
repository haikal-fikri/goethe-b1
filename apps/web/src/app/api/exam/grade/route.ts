import { createGroq } from "@ai-sdk/groq";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { examGradeModelSchema, examGradeRequestSchema, MODEL_ID } from "@repo/core";
import { buildExamMessages, type ExaminerPersona } from "@repo/core";
import { buildGrade, reconcileGrades, PASS_RATIO } from "@repo/core";
import { getExamTask } from "@/lib/exam";
import { getClientIp, checkRateLimit, enforce, enforceAll, gradeBudgetHit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  requireUser,
  RateLimitError,
  supabaseService,
  supabaseServiceConfigured,
} from "@/lib/supabaseServer";
import { log, newRequestId } from "@/lib/log";
import type { ExamGrade, ExaminerResult } from "@/types";

export const runtime = "nodejs";

// DUAL-MODE: gültiger Bearer-JWT → Mobile-Pfad (pro-user-Limits + Persist in
// exam_results + resultId/persisted im done-Event). Kein/ungültiger JWT →
// bestehender Web-Pfad (Turnstile + IP-Limits, KEIN Persist). Gemeinsam:
// globaler fail-closed Budget-Breaker, zod, getExamTask, Vier-Augen-NDJSON
// (byte-für-byte unverändert). Fehler-JSON bleibt in der Altform {error:string}
// (der Web-Client liest data.error als String).

function err(status: number, message: string, extra: Record<string, unknown> = {}) {
  const retryAfterSec = extra.retryAfterSec as number | undefined;
  return Response.json(
    { error: message, ...extra },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(retryAfterSec ? { "Retry-After": String(retryAfterSec) } : {}),
      },
    }
  );
}

export async function POST(request: Request) {
  const requestId = newRequestId();
  if (!process.env.GROQ_API_KEY || process.env.GRADING_ENABLED === "false") {
    return err(503, "Bewertung derzeit nicht verfügbar.");
  }

  // 1) Auth (pre-auth IP-Gate wirft RateLimitError). null → anonymer Web-Pfad.
  let auth: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    auth = await requireUser(request);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return err(429, "Zu viele Anfragen. Bitte kurz warten.", { retryAfterSec: e.retryAfterSec });
    }
    throw e;
  }

  // 2) Body + zod (ersetzt die manuelle length>=20-Prüfung).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err(400, "Ungültige Anfrage.");
  }
  const turnstileToken = (body as { turnstileToken?: string })?.turnstileToken;
  const parsed = examGradeRequestSchema.safeParse(body);
  if (!parsed.success) {
    const tooShort = parsed.error.issues.some((i) => i.path[0] === "answer");
    return err(422, tooShort ? "Dein Text ist zu kurz für eine Bewertung." : "Ungültige Anfrage.");
  }
  const { taskId, answer } = parsed.data;

  // 3) Autoritative Aufgabe (Client liefert nie Punkte/Task).
  const task = await getExamTask(taskId);
  if (!task) return err(404, "Unbekannte Aufgabe.");

  const ip = getClientIp(request);

  // 4) Ratenbegrenzung — je nach Pfad.
  if (auth) {
    const g = await enforceAll([
      () => enforce("gradeIpDay", ip),           // fail-open (Budget deckt)
      () => enforce("gradeBurst", auth!.user.id),
      () => enforce("gradeHour", auth!.user.id),
      () => enforce("gradeDay", auth!.user.id),
    ]);
    if (!g.ok) return err(429, "Zu viele Bewertungen. Bitte versuche es später erneut.", { retryAfterSec: g.retryAfterSec });
  } else {
    // Anonym: Turnstile VOR der Ratenbegrenzung (tokenlose Bots ziehen kein Kontingent).
    if (!(await verifyTurnstile(turnstileToken, ip))) {
      return err(403, "Bitte bestätige, dass du kein Roboter bist.");
    }
    const rl = await checkRateLimit("grade", ip);
    if (!rl.ok) {
      return err(429, `Zu viele Bewertungen. Bitte versuche es in ca. ${rl.retryAfterSec} Sekunden erneut.`, { retryAfterSec: rl.retryAfterSec });
    }
  }

  // 5) Globaler Groq-Budget-Breaker (fail-closed) — direkt vor dem teuren Aufruf.
  const budget = await gradeBudgetHit();
  if (budget.limited) {
    return err(429, "Tageskapazität für Bewertungen erreicht. Bitte versuche es morgen erneut.", { retryAfterSec: budget.retryAfterSec });
  }

  const model = createGroq()(MODEL_ID);

  const gradeWith = async (persona: ExaminerPersona): Promise<ExamGrade> => {
    const { system, prompt } = buildExamMessages(task, answer, persona);
    const call = (extraSystem = "") =>
      generateText({
        model,
        system: system + extraSystem,
        prompt,
        temperature: 0.2,
        maxOutputTokens: 4000,
        maxRetries: 3,
        providerOptions: {
          groq: { reasoningEffort: "low", reasoningFormat: "hidden" },
        },
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
  };

  const userId = auth?.user.id ?? null;

  // NDJSON-Stream — Vier-Augen-Orchestrierung unverändert.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      try {
        send({ type: "start" });

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

        // Persist (nur authed + Service-Role vorhanden). Best-effort: ein Fehler
        // darf die verdiente Note nicht verschlucken (resultId:null, persisted:false).
        let resultId: string | null = null;
        let persisted = false;
        if (userId && supabaseServiceConfigured()) {
          try {
            const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
            const { data, error } = await supabaseService()
              .from("exam_results")
              .insert({
                user_id: userId,
                simulation_id: task.simulation,
                task_id: task.id,
                aufgabe: task.aufgabe,
                gesamtpunkte: reconciled.gesamtpunkte,
                max_punkte: reconciled.maxPunkte,
                bestanden: reconciled.bestanden,
                third_used: thirdUsed,
                result: { reconciled, examiners, thirdUsed },
                answer_text: answer,
                word_count: wordCount,
                model: MODEL_ID,
              })
              .select("id")
              .single();
            if (!error && data) {
              resultId = data.id as string;
              persisted = true;
            } else if (error) {
              log("exam/grade.persist", { requestId, userId, ok: false, err: error.message });
            }
          } catch (e) {
            log("exam/grade.persist", { requestId, userId, ok: false, err: String(e) });
          }
        }

        log("exam/grade", {
          requestId,
          mode: userId ? "authed" : "anon",
          taskId: task.id,
          thirdUsed,
          bestanden: reconciled.bestanden,
          persisted,
        });

        send({ type: "done", grade: reconciled, examiners, thirdUsed, resultId, persisted });
      } catch (e) {
        console.error("[exam/grade] Fehler:", e);
        send({
          type: "error",
          error: "Die Bewertung konnte nicht erstellt werden. Bitte versuche es erneut.",
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
      "X-Request-Id": requestId,
    },
  });
}
