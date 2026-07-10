import { apiError, speakingGradeSchema, pointsFromSpeakingBands } from "@repo/core";
import { requireTeacher, parseJson, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { pushToUser } from "@/lib/push";

// POST /api/speaking/grade — Lehrkraft/TA setzt alle 5 Bänder (aussprache manuell
// in v1); Punkte werden serverseitig aus den Bändern berechnet. Grader-gated
// (is_speaking_grader → Leads UND TAs). teacher-lms/04 §3.1.
export const runtime = "nodejs";

interface SubRow {
  id: string;
  assignment_id: string;
  student_id: string;
  status: string;
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;

  const parsed = await parseJson(req, speakingGradeSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { submissionId, criteria, feedbackDe, release } = parsed;

  // Grader-Autorisierung (Lead/Creator/Owner ODER TA) über den NUTZER-Client.
  const { data: allowed, error: authErr } = await ctx.supabase.rpc("is_speaking_grader", {
    _submission: submissionId,
  });
  if (authErr || !allowed) {
    return apiError(403, "forbidden", "Keine Bewertungsberechtigung für diese Aufnahme.", { requestId });
  }

  const rl = await enforce("gradeTeacher", ctx.user.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Bewertungen. Bitte kurz warten.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  const svc = supabaseService();
  const { data: sub } = await svc
    .from("speaking_submissions")
    .select("id, assignment_id, student_id, status")
    .eq("id", submissionId)
    .maybeSingle<SubRow>();
  if (!sub) return apiError(404, "not_found", "Aufnahme nicht gefunden.", { requestId });
  if (sub.status === "recorded") {
    return apiError(409, "conflict", "Diese Aufnahme wurde noch nicht transkribiert.", { requestId });
  }

  // Punkte serverseitig aus den 5 Bändern (nie vom Client).
  const { gesamt, bestanden } = pointsFromSpeakingBands(criteria);

  const releasedAt = release ? new Date().toISOString() : null;
  const { error: gradeErr } = await svc.from("speaking_grades").upsert(
    {
      submission_id: submissionId,
      graded_by: ctx.user.id,
      criteria, // {erfuellung,kohaerenz,wortschatz,strukturen,aussprache} Bänder A–E
      gesamt,
      bestanden,
      feedback_de: feedbackDe ?? null,
      graded_at: new Date().toISOString(),
      released_at: releasedAt,
    },
    { onConflict: "submission_id" }
  );
  if (gradeErr) {
    log("speaking/grade.persist", { requestId, submissionId, ok: false, err: gradeErr.message });
    return apiError(500, "internal_error", "Bewertung konnte nicht gespeichert werden.", { requestId });
  }

  // Audio-Tail auf graded_at+24h kürzen (Re-Listen direkt nach der Bewertung),
  // status='graded' + notify NUR bei Freigabe.
  if (release) {
    const purgeAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await svc
      .from("speaking_submissions")
      .update({ status: "graded", audio_purge_at: purgeAt })
      .eq("id", submissionId);

    // Sprechen ist „Übungsfeedback" — nie „prüfungsbereit" (04 §3, GDPR-Labelling).
    await svc.rpc("notify", {
      p_user: sub.student_id,
      p_kind: "grade_released",
      p_title: "Dein Sprech-Übungsfeedback ist da",
      p_body: bestanden ? "Bestanden ✅ (Übungsfeedback)" : "Feedback verfügbar (Übungsfeedback)",
      p_data: { submissionId, speakingAssignmentId: sub.assignment_id },
    });
    await pushToUser(sub.student_id, {
      title: "Dein Sprech-Übungsfeedback ist da",
      body: "Tippe, um dein Feedback zu sehen.",
      data: { submissionId },
    });
  }

  log("speaking/grade", { requestId, submissionId, released: release, bestanden });
  return ok({ released: release, gesamt, bestanden }, requestId);
}
