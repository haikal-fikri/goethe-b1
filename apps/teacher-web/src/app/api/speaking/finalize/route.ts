import { apiError, speakingFinalizeSchema } from "@repo/core";
import { authenticate, parseJson, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { presignGet } from "@/lib/r2";
import { transcriber } from "@/lib/transcribe";

// POST /api/speaking/finalize — nach dem R2-Upload: Dauer prüfen → Whisper →
// Transkript + AI-Empfehlung. Der Cost-Breaker ist FAIL-CLOSED. teacher-lms/04 §3.1.
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_DURATION_SEC = 300; // ≤5:00
const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // ≤20 MB — Ingest-Deckel (presigned PUT kann ihn nicht hart erzwingen)

interface SubRow {
  id: string;
  assignment_id: string;
  student_id: string;
  audio_key: string | null;
  status: string;
  created_at: string;
}

export async function POST(req: Request) {
  const requestId = newRequestId();

  const ctx = await authenticate(req, requestId);
  if (ctx instanceof Response) return ctx;
  const studentId = ctx.user.id;

  const parsed = await parseJson(req, speakingFinalizeSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { submissionId } = parsed;

  if (process.env.TRANSCRIBE_ENABLED === "false") {
    return apiError(503, "upstream_error", "Transkription derzeit nicht verfügbar.", { requestId });
  }

  const svc = supabaseService();

  // 1) Eigene Aufnahme im Zustand 'recorded'.
  const { data: sub } = await svc
    .from("speaking_submissions")
    .select("id, assignment_id, student_id, audio_key, status, created_at")
    .eq("id", submissionId)
    .maybeSingle<SubRow>();
  if (!sub || sub.student_id !== studentId) {
    return apiError(404, "not_found", "Aufnahme nicht gefunden.", { requestId });
  }
  if (sub.status !== "recorded") {
    return apiError(409, "conflict", "Diese Aufnahme ist bereits verarbeitet.", { requestId });
  }
  if (!sub.audio_key) {
    return apiError(409, "conflict", "Für diese Aufnahme fehlt die Audio-Datei.", { requestId });
  }

  // 2) Einwilligung erneut prüfen (kann zwischen submit und finalize widerrufen sein).
  const { data: consentOk } = await svc.rpc("guardian_consent_ok", { p_student: studentId });
  if (!consentOk) {
    return apiError(403, "forbidden", "Für Sprachaufnahmen fehlt die Einwilligung.", {
      requestId,
      details: { reason: "consent_required" },
    });
  }

  // Lehrkraft (für whisper-Limiter + Usage-Metering).
  const { data: sa } = await svc
    .from("speaking_assignments")
    .select("class_id")
    .eq("id", sub.assignment_id)
    .maybeSingle<{ class_id: string }>();
  const { data: cls } = sa
    ? await svc.from("classes").select("teacher_id").eq("id", sa.class_id).maybeSingle<{ teacher_id: string }>()
    : { data: null };
  const teacherId = cls?.teacher_id ?? null;

  // 3) transcribe_budget_hit FAIL-CLOSED (Groq-Whisper-Kostendeckel).
  const { data: budget, error: budgetErr } = await svc.rpc("transcribe_budget_hit");
  const budgetRow = budget?.[0] as { limited: boolean; retry_after: number } | undefined;
  if (budgetErr || !budgetRow || budgetRow.limited) {
    return apiError(429, "rate_limited", "Tageskapazität für Transkriptionen erreicht. Bitte später erneut.", {
      requestId,
      retryAfter: budgetRow?.retry_after ?? 3600,
    });
  }
  if (teacherId) {
    const rl = await enforce("whisperTeacher", teacherId); // fail-open (Budget deckt)
    if (!rl.ok) {
      return apiError(429, "rate_limited", "Zu viele Transkriptionen. Bitte später erneut.", {
        requestId,
        retryAfter: rl.retryAfterSec,
      });
    }
  }

  // 4) Atomischer CLAIM (recorded→scored, compare-and-swap) VOR der teuren
  //    Transkription: die Statusprüfung oben (Zeile ~51) ist ein reiner Read und
  //    serialisiert NICHTS. Nur dieser bedingte UPDATE hat genau einen Gewinner —
  //    ein gleichzeitiger/wiederholter finalize kann so nicht doppelt
  //    transkribieren (2× Whisper) oder bump_usage doppelt zählen (TOCTOU-Fix).
  const { data: claimed } = await svc
    .from("speaking_submissions")
    .update({ status: "scored" })
    .eq("id", submissionId)
    .eq("status", "recorded")
    .select("id");
  if (!claimed || claimed.length === 0) {
    return apiError(409, "conflict", "Diese Aufnahme wird bereits verarbeitet.", { requestId });
  }
  // Bei jedem Fehlschlag den Claim zurücknehmen (→ 'recorded'), damit ein Retry
  // möglich bleibt (sonst hinge die Zeile in 'scored' ohne Transkript).
  const revertClaim = async () => {
    await svc.from("speaking_submissions").update({ status: "recorded" }).eq("id", submissionId);
  };

  // ── R2-Fetch + Whisper (Phase-6-Seam-Grenze) ────────────────────────────────
  // r2.presignGet + transcriber.transcribe werfen bis zur Phase-6-Verdrahtung →
  // sauberer 503 (Claim wird zurückgenommen). Danach: Dauer-Guard, Transkript, Usage.
  try {
    const getUrl = await presignGet(sub.audio_key);
    const res = await fetch(getUrl);
    if (!res.ok) throw new Error(`r2 get ${res.status}`);
    // Größendeckel VOR dem Puffern: presigned PUT kann keine Content-Length-Range
    // erzwingen, ein Client könnte also ein überdimensioniertes Objekt hochgeladen
    // haben. R2 liefert Content-Length beim GET → zu groß ⇒ 422 (Claim zurück),
    // OHNE das Objekt in den Speicher zu ziehen (OOM-/Egress-Schutz).
    const declaredBytes = Number(res.headers.get("content-length"));
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_AUDIO_BYTES) {
      await revertClaim();
      return apiError(422, "validation_failed", "Die Aufnahme ist zu groß (max. 20 MB).", { requestId });
    }
    const audio = await res.arrayBuffer();
    const { text, durationSec, model } = await transcriber.transcribe(audio, { languageDe: true });

    if (durationSec !== undefined && durationSec > MAX_DURATION_SEC) {
      await revertClaim();
      return apiError(422, "validation_failed", "Die Aufnahme ist länger als 5 Minuten.", { requestId });
    }

    const purgeAt = new Date(new Date(sub.created_at).getTime() + 72 * 3600 * 1000).toISOString();
    await svc
      .from("speaking_submissions")
      .update({
        transcript: text,
        transcribed_at: new Date().toISOString(),
        audio_purge_at: purgeAt,
        duration_ms: durationSec !== undefined ? Math.round(durationSec * 1000) : null,
      })
      .eq("id", submissionId);

    // AI-Empfehlung (4 Inhaltskriterien, KEIN aussprache) → Phase 6 (speaking-tuned
    // Prompt). Transkript reicht der Lehrkraft, um manuell alle 5 Bänder zu setzen.

    if (teacherId && durationSec !== undefined) {
      await svc.rpc("bump_usage", {
        p_teacher: teacherId,
        p_audio_seconds: Math.round(durationSec),
        p_speaking: 1,
      });
    }

    log("speaking/finalize", { requestId, submissionId, model, ok: true });
    return ok({ status: "scored" }, requestId);
  } catch (e) {
    await revertClaim(); // Claim zurücknehmen → Retry bleibt möglich
    log("speaking/finalize.transcribe", { requestId, submissionId, ok: false, err: String(e) });
    return apiError(503, "upstream_error", "Transkription derzeit nicht verfügbar.", { requestId });
  }
}
