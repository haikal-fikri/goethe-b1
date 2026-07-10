import { ok, requireCron } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { newRequestId, log } from "@/lib/log";
import { pushToUser } from "@/lib/push";

// POST /api/jobs/session-reminders — stündlich. (a) Termine im Erinnerungsfenster
// → notify 'session_reminder' + Push; (b) PUSH-FLUSH: notifications mit
// pushed_at IS NULL (Trigger-Herkunft, z.B. assignment_new) versenden + stampen.
// teacher-lms/03 §2.9.
export const runtime = "nodejs";

// ⚠️ OWNER-CONFIRM: Vorlaufzeit. 1-Stunden-Fenster [+23h,+24h] ⇒ jede Sitzung wird
// bei stündlichem Cron genau EINMAL erinnert (es gibt keine reminded_at-Spalte).
const LEAD_MS = 24 * 3600 * 1000;
const WINDOW_MS = 3600 * 1000;

interface SessRow {
  id: string;
  class_id: string;
  starts_at: string;
}
interface NotifRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const denied = requireCron(req, requestId);
  if (denied) return denied;

  const svc = supabaseService();
  const now = Date.now();
  const from = new Date(now + LEAD_MS - WINDOW_MS).toISOString();
  const to = new Date(now + LEAD_MS).toISOString();

  // (a) Erinnerungen für Termine im Fenster.
  const { data: sessions } = await svc
    .from("class_sessions")
    .select("id, class_id, starts_at")
    .eq("status", "scheduled")
    .gt("starts_at", from)
    .lte("starts_at", to)
    .returns<SessRow[]>();

  let reminded = 0;
  for (const s of sessions ?? []) {
    const { data: enrolled } = await svc
      .from("class_enrollments")
      .select("student_id")
      .eq("class_id", s.class_id)
      .eq("status", "active")
      .returns<{ student_id: string }[]>();
    for (const e of enrolled ?? []) {
      await svc.rpc("notify", {
        p_user: e.student_id,
        p_kind: "session_reminder",
        p_title: "Erinnerung: bevorstehender Termin",
        p_body: "Du hast bald einen Klassentermin.",
        p_data: { classId: s.class_id, sessionId: s.id, startsAt: s.starts_at },
      });
      reminded++;
    }
  }

  // (b) Push-Flush — NUR Trigger-Herkunfts-Zeilen (kind='assignment_new', via
  //     trg_assignment_notify/trg_speaking_assignment_notify), die KEINEN Inline-
  //     Push haben. Alle Route-Herkunfts-kinds (assignment_graded, grade_released,
  //     session_canceled, enrollment_removed) werden in ihren Routen bereits inline
  //     gepusht → ohne diesen Filter würde der Flush sie ein ZWEITES Mal senden.
  const { data: pending } = await svc
    .from("notifications")
    .select("id, user_id, kind, title, body, data")
    .is("pushed_at", null)
    .eq("kind", "assignment_new")
    .limit(300)
    .returns<NotifRow[]>();

  let flushed = 0;
  for (const n of pending ?? []) {
    const sent = await pushToUser(n.user_id, {
      title: n.title,
      body: n.body ?? undefined,
      data: { ...n.data, kind: n.kind },
    });
    if (sent) {
      await svc.from("notifications").update({ pushed_at: new Date().toISOString() }).eq("id", n.id);
      flushed++;
    }
  }

  log("jobs/session-reminders", { requestId, reminded, flushed });
  return ok({ reminded, flushed }, requestId);
}
