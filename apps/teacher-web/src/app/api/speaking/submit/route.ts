import { apiError, speakingSubmitSchema, fairUseStatus, PRO_FAIR_USE_CEILINGS } from "@repo/core";
import { authenticate, parseJson, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { presignPut, deleteObject } from "@/lib/r2";

// POST /api/speaking/submit — Schüler:in startet eine Sprechaufnahme. Der Server
// erzeugt Zeile + audio_key + Presign; der Client PUTet danach die Audio zu R2.
// Der Client schreibt NIE die Zeile/den Key. teacher-lms/04 §3.1.
export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // ≤20 MB — Client-Hinweis; hart erzwungen erst in finalize (presigned PUT kann keine Content-Length-Range pinnen)

function utcPeriod(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

export async function POST(req: Request) {
  const requestId = newRequestId();

  const ctx = await authenticate(req, requestId);
  if (ctx instanceof Response) return ctx;
  const studentId = ctx.user.id;

  const parsed = await parseJson(req, speakingSubmitSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { assignmentId } = parsed;

  const svc = supabaseService();

  // 1) Sprech-Aufgabe + Klasse (speaking_assignments, NICHT assignments).
  const { data: sa } = await svc
    .from("speaking_assignments")
    .select("id, class_id")
    .eq("id", assignmentId)
    .maybeSingle<{ id: string; class_id: string }>();
  if (!sa) return apiError(404, "not_found", "Unbekannte Sprech-Aufgabe.", { requestId });

  // 2) Eingeschrieben (aktiv) + Lehrkraft mit aktivem Abo.
  const { data: enrollment } = await svc
    .from("class_enrollments")
    .select("student_id")
    .eq("class_id", sa.class_id)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();
  if (!enrollment) {
    return apiError(403, "forbidden", "Du bist nicht in dieser Klasse eingeschrieben.", { requestId });
  }
  const { data: cls } = await svc
    .from("classes")
    .select("teacher_id")
    .eq("id", sa.class_id)
    .maybeSingle<{ teacher_id: string }>();
  const teacherId = cls?.teacher_id;
  if (!teacherId) return apiError(404, "not_found", "Klasse nicht gefunden.", { requestId });
  const { data: subOk } = await svc.rpc("has_active_teacher_sub", { p_teacher: teacherId });
  if (!subOk) return apiError(403, "forbidden", "Das Klassen-Abo ist nicht aktiv.", { requestId });

  // 3) Erziehungsberechtigten-Einwilligung (Stimme) — sonst 403 consent_required.
  const { data: consentOk } = await svc.rpc("guardian_consent_ok", { p_student: studentId });
  if (!consentOk) {
    return apiError(403, "forbidden", "Für Sprachaufnahmen fehlt die Einwilligung.", {
      requestId,
      details: { reason: "consent_required" },
    });
  }

  // 4) speakSubmit FAIL-CLOSED (Audio-Ingest + Whisper-Kosten).
  const rl = await enforce("speakSubmit", studentId, /* failClosed */ true);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Aufnahmen. Bitte später erneut.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  // 5) Fair-Use: NEUE Aufnahmen bei ≥120 % der Audio-Grenze drosseln (05 §3.2).
  //    Live-Neubewertung (kein DB-Gate) — owner-tunebar. Gilt für Pro-Soft-Ceilings.
  const { data: usage } = await svc
    .from("usage_counters")
    .select("graded_audio_seconds")
    .eq("teacher_id", teacherId)
    .eq("period", utcPeriod())
    .maybeSingle<{ graded_audio_seconds: number }>();
  const fu = fairUseStatus(
    { activeStudents: 0, classes: 0, gradedAudioSeconds: Number(usage?.graded_audio_seconds ?? 0) },
    PRO_FAIR_USE_CEILINGS
  );
  if (fu.throttleNewSpeaking) {
    return apiError(429, "rate_limited", "Fair-Use-Grenze erreicht. Bewertung neuer Aufnahmen ist vorübergehend pausiert — bitte kontaktiere uns.", { requestId });
  }

  // 6) Zeile + server-generierter audio_key. Eine bestehende (assignment,student)-
  //    Zeile wird WIEDERVERWENDET (STABILER PK): niemals `id` im Konflikt-Update
  //    mutieren — speaking_grades.submission_id ist ein FK auf id (ON UPDATE NO
  //    ACTION), ein PK-Wechsel würde nach dem Benoten eine FK-Verletzung werfen.
  //    Bereits benotet ⇒ 409 (kein Redo-Overwrite der Note).
  const { data: existing } = await svc
    .from("speaking_submissions")
    .select("id, status, audio_key")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .maybeSingle<{ id: string; status: string; audio_key: string | null }>();
  if (existing?.status === "graded") {
    return apiError(409, "conflict", "Diese Aufnahme wurde bereits bewertet.", { requestId });
  }
  const submissionId = existing?.id ?? crypto.randomUUID();
  const audioKey = `speaking/${sa.class_id}/${submissionId}/${crypto.randomUUID()}.m4a`;
  const persist = existing
    ? await svc
        .from("speaking_submissions")
        .update({ audio_key: audioKey, status: "recorded", transcript: null, transcribed_at: null })
        .eq("id", submissionId)
    : await svc.from("speaking_submissions").insert({
        id: submissionId,
        assignment_id: assignmentId,
        student_id: studentId,
        audio_key: audioKey,
        status: "recorded",
      });
  if (persist.error) {
    log("speaking/submit.persist", { requestId, ok: false, err: persist.error.message });
    return apiError(500, "internal_error", "Aufnahme konnte nicht angelegt werden.", { requestId });
  }

  // Beim Wiederaufnehmen wird der audio_key rotiert; das ALTE R2-Objekt ist danach
  // von keiner Zeile mehr referenziert und würde vom key-basierten purge-Cron nie
  // gefunden (permanenter Storage-Leak / DSGVO-Aufbewahrung). Deshalb best-effort löschen.
  if (existing?.audio_key && existing.audio_key !== audioKey) {
    try {
      await deleteObject(existing.audio_key);
    } catch (e) {
      log("speaking/submit.orphan_delete", { requestId, submissionId, ok: false, err: String(e) });
    }
  }

  // 7) Kurzlebiges (≤300 s) R2-PUT-Presign — nur Content-Type wird signiert/gepinnt
  //    (presigned PUT kann keine Content-Length-Range erzwingen; die ≤20-MB-Grenze
  //    setzt finalize per GET-Content-Length durch). URL wird NIE geloggt/gespeichert.
  try {
    const uploadUrl = await presignPut(audioKey, {
      maxBytes: MAX_AUDIO_BYTES,
      contentType: "audio/m4a",
    });
    log("speaking/submit", { requestId, assignmentId, ok: true });
    return ok({ submissionId, uploadUrl }, requestId);
  } catch (e) {
    log("speaking/submit.presign", { requestId, submissionId, ok: false, err: String(e) });
    return apiError(503, "upstream_error", "Sprachaufnahme derzeit nicht verfügbar.", { requestId });
  }
}
