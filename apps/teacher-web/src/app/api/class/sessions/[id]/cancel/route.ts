import { apiError, cancelSchema } from "@repo/core";
import { requireTeacher, parseJson, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { pushToUser } from "@/lib/push";

// POST /api/class/sessions/:id/cancel — Termin absagen + Fan-out. cancel_session
// läuft über den NUTZER-Client (self-check is_session_teacher, raise 42501→403);
// die Route fächert danach notify + Push an die betroffenen Schüler auf. 03 §2.2.
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;

  const { id: sessionId } = await params;
  const parsed = await parseJson(req, cancelSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { reason } = parsed;

  const rl = await enforce("sessionCancel", ctx.user.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Absagen. Bitte kurz warten.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  // cancel_session self-checkt is_session_teacher (raise 42501) und gibt die
  // betroffenen student_ids zurück. Über den NUTZER-Client, damit auth.uid() greift.
  const { data, error } = await ctx.supabase.rpc("cancel_session", {
    p_session: sessionId,
    p_reason: reason ?? null,
  });
  if (error) {
    if (error.code === "42501") {
      return apiError(403, "forbidden", "Keine Berechtigung für diesen Termin.", { requestId });
    }
    log("class/sessions.cancel", { requestId, sessionId, ok: false, err: error.message });
    return apiError(500, "internal_error", "Absage fehlgeschlagen.", { requestId });
  }

  const studentIds = ((data ?? []) as Array<string | { cancel_session: string }>).map((r) =>
    typeof r === "string" ? r : r.cancel_session
  );
  // Idempotent: bereits abgesagt → keine betroffenen Schüler → kein Re-Notify.
  if (studentIds.length === 0) {
    return ok({ canceled: false }, requestId);
  }

  const svc = supabaseService();
  const { data: sess } = await svc
    .from("class_sessions")
    .select("class_id")
    .eq("id", sessionId)
    .maybeSingle<{ class_id: string }>();
  const classId = sess?.class_id ?? null;

  for (const studentId of studentIds) {
    await svc.rpc("notify", {
      p_user: studentId,
      p_kind: "session_canceled",
      p_title: "Ein Termin wurde abgesagt",
      p_body: reason ? `Grund: ${reason}` : "Ein geplanter Termin fällt aus.",
      p_data: { classId, sessionId },
    });
  }
  // Push best-effort je Empfänger (die notifications-Zeile ist die Wahrheit).
  await Promise.all(
    studentIds.map((studentId) =>
      pushToUser(studentId, {
        title: "Ein Termin wurde abgesagt",
        body: "Tippe für Details.",
        data: { classId, sessionId },
      })
    )
  );

  log("class/sessions.cancel", { requestId, sessionId, notified: studentIds.length });
  return ok({ canceled: true, notified: studentIds.length }, requestId);
}
