import { apiError, removeStudentSchema } from "@repo/core";
import { requireTeacher, parseJson, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { pushToUser } from "@/lib/push";

// POST /api/class/remove-student — Lehrkraft entfernt eine:n Teilnehmer:in
// (enrollment → 'removed'; die Einschreibung wird nie hart gelöscht). teacher-lms/03 #6.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;

  const parsed = await parseJson(req, removeStudentSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { classId, studentId } = parsed;

  const { data: isTeacher } = await ctx.supabase.rpc("is_class_teacher", { _class: classId });
  if (!isTeacher) return apiError(403, "forbidden", "Keine Berechtigung für diese Klasse.", { requestId });

  const rl = await enforce("removeStudent", ctx.user.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Änderungen. Bitte kurz warten.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  const svc = supabaseService();
  const { data: updated, error } = await svc
    .from("class_enrollments")
    .update({ status: "removed" })
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .select("student_id");
  if (error) {
    log("class/remove-student.persist", { requestId, classId, ok: false, err: error.message });
    return apiError(500, "internal_error", "Entfernen fehlgeschlagen.", { requestId });
  }
  const removed = (updated ?? []).length > 0;

  if (removed) {
    await svc.rpc("notify", {
      p_user: studentId,
      p_kind: "enrollment_removed",
      p_title: "Klassen-Mitgliedschaft beendet",
      p_body: "Du wurdest aus einer Klasse entfernt.",
      p_data: { classId },
    });
    await pushToUser(studentId, {
      title: "Klassen-Mitgliedschaft beendet",
      body: "Du wurdest aus einer Klasse entfernt.",
      data: { classId },
    });
  }

  log("class/remove-student", { requestId, classId, removed });
  return ok({ removed }, requestId);
}
