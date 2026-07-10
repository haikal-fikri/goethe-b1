import { apiError } from "@repo/core";
import { requireTeacher, ok } from "@/lib/guard";
import { newRequestId } from "@/lib/log";

// GET /api/assignments/:id/review — Lehrkraft/TA-Review-Payload für EINE Abgabe
// (`:id` = submission_id). Reads laufen über den NUTZER-scoped Client → die
// „asub/asub_ai/agrade teacher read"-Policies (app_teacher_can_read, admittiert
// Leads UND TAs) gaten sie; nicht lesbar ⇒ 404. teacher-lms/03 §2.4.
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;
  const { id: submissionId } = await params;

  const { data: submission } = await ctx.supabase
    .from("assignment_submissions")
    .select("id, assignment_id, student_id, answer_text, word_count, status, submitted_at")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) {
    // RLS-gated: nicht der Grader dieser Klasse, oder Abgabe existiert nicht.
    return apiError(404, "not_found", "Abgabe nicht gefunden.", { requestId });
  }

  const [{ data: recommendation }, { data: grade }] = await Promise.all([
    ctx.supabase
      .from("assignment_ai_recommendations")
      .select("recommended, model")
      .eq("submission_id", submissionId)
      .maybeSingle(),
    ctx.supabase
      .from("assignment_grades")
      .select("final, gesamtpunkte, max_punkte, bestanden, teacher_remark_de, released_at, graded_at")
      .eq("submission_id", submissionId)
      .maybeSingle(),
  ]);

  return ok({ submission, recommendation, grade }, requestId);
}
