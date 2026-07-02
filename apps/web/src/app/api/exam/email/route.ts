import { getResend, RESEND_FROM_HEADER } from "@/lib/resend";
import { siteUrl } from "@/lib/site";
import { getClientIp, checkRateLimit, enforce, enforceAll } from "@/lib/ratelimit";
import {
  buildSubject,
  examEmailSchema,
  renderExamResultEmail,
  type ExamEmailPayload,
} from "@/lib/email/examResultEmail";
import { examEmailRequestSchema } from "@repo/core";
import { requireUser, RateLimitError } from "@/lib/supabaseServer";
import { getExamTask } from "@/lib/exam";
import { log, newRequestId } from "@/lib/log";
import type { ExamResult } from "@/types";

export const runtime = "nodejs";

// DUAL-MODE: gültiger JWT → Self-Copy (Empfänger = eigene E-Mail aus dem JWT,
// Bewertung serverseitig aus exam_results via RLS-own geladen, kein Client-Text).
// Kein JWT → bestehender Web-Pfad (/pruefen: Client-Payload an Lehrkraft/Lernende).
// Fehler-JSON in Altform {error:string} (Web-Client-Kompatibilität).
function err(status: number, message: string, extra: Record<string, unknown> = {}) {
  const retryAfterSec = extra.retryAfterSec as number | undefined;
  return Response.json(
    { error: message, ...extra },
    { status, headers: { "Cache-Control": "no-store", ...(retryAfterSec ? { "Retry-After": String(retryAfterSec) } : {}) } }
  );
}

export async function POST(request: Request) {
  const requestId = newRequestId();
  if (!process.env.RESEND_API_KEY) {
    return err(500, "RESEND_API_KEY ist nicht gesetzt.");
  }

  let auth: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    auth = await requireUser(request);
  } catch (e) {
    if (e instanceof RateLimitError) return err(429, "Zu viele Anfragen. Bitte kurz warten.", { retryAfterSec: e.retryAfterSec });
    throw e;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err(400, "Ungültige Anfrage.");
  }

  // ── Authentifizierter Self-Copy-Pfad (Mobile) ──────────────────────
  if (auth) {
    const parsed = examEmailRequestSchema.safeParse(body);
    if (!parsed.success) return err(400, "Ungültige Anfrage.");
    const email = auth.user.email;
    if (!email) return err(400, "Kein E-Mail-Konto hinterlegt.");

    const rl = await enforceAll([
      () => enforce("emailWin", auth!.user.id),
      () => enforce("emailDay", auth!.user.id),
    ]);
    if (!rl.ok) return err(429, "Zu viele E-Mails. Bitte später erneut.", { retryAfterSec: rl.retryAfterSec });

    // RLS-own: liefert die Zeile nur, wenn sie dem Aufrufer gehört (sonst leer → 403).
    const { data: row, error } = await auth.supabase
      .from("exam_results")
      .select("task_id, aufgabe, result, answer_text")
      .eq("id", parsed.data.resultId)
      .single();
    if (error || !row) return err(403, "Ergebnis nicht gefunden.");

    const result = row.result as ExamResult;
    const task = row.task_id ? await getExamTask(row.task_id) : undefined;
    const payload: ExamEmailPayload = {
      recipients: { studentEmail: email, teacherEmail: email },
      task: {
        titleDe: task?.titleDe ?? "Schreibaufgabe",
        taskType: task?.taskType ?? "Aufgabe",
        aufgabe: (task?.aufgabe ?? row.aufgabe) as 1 | 2 | 3,
        promptDe: task?.promptDe ?? "",
        bulletPointsDe: task?.bulletPointsDe,
        minWords: task?.minWords ?? 0,
      },
      essay: row.answer_text?.trim() || "(kein Text gespeichert)",
      grade: result.reconciled,
      examiners: result.examiners,
      thirdUsed: result.thirdUsed,
    };

    try {
      const { data, error: sendErr } = await getResend().emails.send({
        from: RESEND_FROM_HEADER,
        to: email, // NUR die eigene Adresse (kein Client-Empfänger)
        subject: buildSubject(payload),
        html: renderExamResultEmail(payload, siteUrl),
      });
      if (sendErr) {
        console.error("[exam/email] Resend error:", sendErr);
        return err(502, "Die E-Mail konnte nicht versendet werden.");
      }
      log("exam/email", { requestId, mode: "self", ok: true });
      return Response.json({ success: true, id: data?.id });
    } catch (e) {
      console.error("[exam/email] send failed:", e);
      return err(500, "Die E-Mail konnte nicht versendet werden.");
    }
  }

  // ── Anonymer Web-Pfad (/pruefen — unverändertes Verhalten) ─────────
  const parsed = examEmailSchema.safeParse(body);
  if (!parsed.success) return err(400, "Die E-Mail-Daten sind unvollständig oder ungültig.");

  const rl = await checkRateLimit("email", getClientIp(request));
  if (!rl.ok) {
    return err(429, `Zu viele E-Mails. Bitte versuche es in ca. ${rl.retryAfterSec} Sekunden erneut.`, { retryAfterSec: rl.retryAfterSec });
  }

  const payload = parsed.data;
  const { studentEmail, teacherEmail } = payload.recipients;
  const sameRecipient = studentEmail.toLowerCase() === teacherEmail.toLowerCase();

  try {
    const { data, error } = await getResend().emails.send({
      from: RESEND_FROM_HEADER,
      to: teacherEmail,
      ...(sameRecipient ? {} : { cc: studentEmail }),
      replyTo: studentEmail,
      subject: buildSubject(payload),
      html: renderExamResultEmail(payload, siteUrl),
    });
    if (error) {
      console.error("[exam/email] Resend error:", error);
      return err(502, "Die E-Mail konnte nicht versendet werden.");
    }
    return Response.json({ success: true, id: data?.id });
  } catch (e) {
    console.error("[exam/email] send failed:", e);
    return err(500, "Die E-Mail konnte nicht versendet werden.");
  }
}
