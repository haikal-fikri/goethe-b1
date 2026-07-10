import { apiError, submitWritingSchema } from "@repo/core";
import { parseJson, authenticate, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { log, newRequestId } from "@/lib/log";
import { resolveWritingTask } from "@/lib/resolveWritingTask";
import { gradeWritingVierAugen } from "@/lib/grade";

// POST /api/assignments/:id/submit — Schüler:in reicht den Aufsatz ein; die
// Vier-Augen-KI-Bewertung läuft synchron und wird als teacher-only Empfehlung
// gespeichert. Der Client schreibt NIE answer_text/status direkt. teacher-lms/04 §2.3.
export const runtime = "nodejs";
export const maxDuration = 300; // Groq Vier-Augen synchron (03 §2.3)

interface AssignmentRow {
  id: string;
  class_id: string;
  kind: string;
  task_id: string | null;
  prompt_de: string | null;
  bullet_points_de: string[];
  min_words: number | null;
  due_at: string | null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = newRequestId();

  // Kill-switch (teilt sich mit dem Studenten-Grader).
  if (!process.env.GROQ_API_KEY || process.env.GRADING_ENABLED === "false") {
    return apiError(503, "upstream_error", "Bewertung derzeit nicht verfügbar.", { requestId });
  }

  // 1) Auth (Schüler-JWT, KEINE Lehrer-Rolle).
  const ctx = await authenticate(req, requestId);
  if (ctx instanceof Response) return ctx;
  const studentId = ctx.user.id;

  const { id: assignmentId } = await params;
  const parsed = await parseJson(req, submitWritingSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { answerText } = parsed;

  const svc = supabaseService();

  // 2) Aufgabe + Klasse autoritativ laden (Service-Role).
  const { data: assignment } = await svc
    .from("assignments")
    .select("id, class_id, kind, task_id, prompt_de, bullet_points_de, min_words, due_at")
    .eq("id", assignmentId)
    .maybeSingle<AssignmentRow>();
  if (!assignment || assignment.kind !== "writing") {
    return apiError(404, "not_found", "Unbekannte Aufgabe.", { requestId });
  }

  // 3) Eingeschrieben? (aktive Einschreibung + Lehrkraft mit aktivem Abo)
  const { data: enrollment } = await svc
    .from("class_enrollments")
    .select("student_id")
    .eq("class_id", assignment.class_id)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();
  if (!enrollment) {
    return apiError(403, "forbidden", "Du bist nicht in dieser Klasse eingeschrieben.", { requestId });
  }
  const { data: cls } = await svc
    .from("classes")
    .select("teacher_id")
    .eq("id", assignment.class_id)
    .maybeSingle<{ teacher_id: string }>();
  const teacherId = cls?.teacher_id;
  if (!teacherId) return apiError(404, "not_found", "Klasse nicht gefunden.", { requestId });
  const { data: subOk } = await svc.rpc("has_active_teacher_sub", { p_teacher: teacherId });
  if (!subOk) {
    return apiError(403, "forbidden", "Das Klassen-Abo ist nicht aktiv.", { requestId });
  }

  // 4) Fälligkeit (Due-Lock).
  if (assignment.due_at && new Date(assignment.due_at).getTime() < Date.now()) {
    return apiError(409, "conflict", "Die Abgabefrist ist verstrichen.", { requestId });
  }

  // 5) Bereits bewertet? → keine Neu-Einreichung (verhindert Überschreiben der Note).
  const { data: existing } = await svc
    .from("assignment_submissions")
    .select("id, status")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .maybeSingle<{ id: string; status: string }>();
  if (existing?.status === "graded") {
    return apiError(409, "conflict", "Diese Aufgabe wurde bereits bewertet.", { requestId });
  }

  // 6) Budget-Breaker (fail-CLOSED — Groq-Rechnung darf nicht fail-open sein).
  const { data: budget, error: budgetErr } = await svc.rpc("grade_budget_hit");
  const budgetRow = budget?.[0] as { limited: boolean; retry_after: number } | undefined;
  if (budgetErr || !budgetRow || budgetRow.limited) {
    return apiError(429, "rate_limited", "Tageskapazität für Bewertungen erreicht. Bitte später erneut.", {
      requestId,
      retryAfter: budgetRow?.retry_after ?? 3600,
    });
  }
  // Per-Schüler-Limiter (fail-open — der Budget-Breaker deckt den Groq-Kostenpfad).
  const rl = await enforce("assignSubmit", studentId);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Abgaben. Bitte später erneut.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  // 7) Einreichung persistieren (Service-Role; Client schreibt NIE selbst).
  const wordCount = answerText.split(/\s+/).filter(Boolean).length;
  const { data: sub, error: subErr } = await svc
    .from("assignment_submissions")
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: studentId,
        answer_text: answerText,
        word_count: wordCount,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,student_id" }
    )
    .select("id")
    .single();
  if (subErr || !sub) {
    log("assignments/submit.persist", { requestId, ok: false, err: subErr?.message });
    return apiError(500, "internal_error", "Abgabe konnte nicht gespeichert werden.", { requestId });
  }
  const submissionId = sub.id as string;

  // 8) Vier-Augen-Bewertung — synchron, best-effort. Ein Grader-Fehler darf die
  //    Abgabe NICHT verschlucken: status bleibt 'submitted', 202, Re-Grade später.
  const task = await resolveWritingTask(assignment);
  if (!task) {
    return ok({ status: "submitted", grade: "pending" }, requestId, 202);
  }
  try {
    const { recommended } = await gradeWritingVierAugen(task, answerText);
    await svc
      .from("assignment_ai_recommendations")
      .upsert(
        { submission_id: submissionId, recommended, model: "openai/gpt-oss-120b" },
        { onConflict: "submission_id" }
      );
    // bump_usage am KOSTENPUNKT (KI-Grade = Submit). Der Lehrer-Grade bumpt NICHT
    // erneut (writing_ai_grades misst KI-Bewertungen). Reconciliation der doppelten
    // Nennung in 03 §2.3/§2.5 — bewusst genau EINMAL hier.
    await svc.rpc("bump_usage", { p_teacher: teacherId, p_writing: 1 });
  } catch (e) {
    log("assignments/submit.grade", { requestId, submissionId, ok: false, err: String(e) });
    return ok({ status: "submitted", grade: "pending" }, requestId, 202);
  }

  log("assignments/submit", { requestId, assignmentId, ok: true });
  return ok({ status: "submitted" }, requestId);
}
