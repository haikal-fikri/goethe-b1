import { apiError, examFeedbackSchema } from "@repo/core";
import { requireTeacher, parseJson, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { pushToUser } from "@/lib/push";

// POST /api/exam-feedback — Lehrkraft-Feedback zu einem Built-in-Sim-Ergebnis.
// Der Aufsatz (exam_results.answer_text) bleibt teacher-read-only. Release-gated
// wie die Noten. teacher-lms/03 §2.10.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;

  const parsed = await parseJson(req, examFeedbackSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { examResultId, feedbackDe, release } = parsed;

  const svc = supabaseService();

  // Owner des Ergebnisses auflösen + Lese-/Sub-Berechtigung (app_teacher_can_read
  // deckt is_class_grader + class_sub_active für eine aktive geteilte Klasse).
  const { data: ownerId } = await svc.rpc("exam_result_owner", { _result: examResultId });
  if (!ownerId) return apiError(404, "not_found", "Ergebnis nicht gefunden.", { requestId });
  const { data: canRead } = await ctx.supabase.rpc("app_teacher_can_read", { _student: ownerId });
  if (!canRead) {
    return apiError(403, "forbidden", "Keine Berechtigung für dieses Ergebnis.", { requestId });
  }

  const rl = await enforce("gradeTeacher", ctx.user.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  const releasedAt = release ? new Date().toISOString() : null;
  const { error } = await svc.from("exam_result_feedback").upsert(
    {
      exam_result_id: examResultId,
      teacher_id: ctx.user.id,
      feedback_de: feedbackDe,
      released_at: releasedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "exam_result_id" }
  );
  if (error) {
    log("exam-feedback.persist", { requestId, ok: false, err: error.message });
    return apiError(500, "internal_error", "Feedback konnte nicht gespeichert werden.", { requestId });
  }

  if (release) {
    await svc.rpc("notify", {
      p_user: ownerId,
      p_kind: "grade_released",
      p_title: "Feedback zu deiner Prüfungssimulation",
      p_body: "Deine Lehrkraft hat dir Feedback gegeben.",
      p_data: { examResultId },
    });
    await pushToUser(ownerId as string, {
      title: "Feedback zu deiner Prüfungssimulation",
      body: "Tippe, um es zu lesen.",
      data: { examResultId },
    });
  }

  log("exam-feedback", { requestId, released: release });
  return ok({ released: release }, requestId);
}
