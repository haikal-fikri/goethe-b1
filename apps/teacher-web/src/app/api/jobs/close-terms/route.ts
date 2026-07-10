import { ok, requireCron } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { newRequestId, log } from "@/lib/log";
import { audit } from "@/lib/audit";

// POST /api/jobs/close-terms — nächtlich (D13). Beendete Terme automatisch
// archivieren (term_end < today, archived_at null) → sperrt neue Arbeit
// (is_class_locked); Grade-Routen bleiben offen. Es gibt KEINE close_terms()-
// Funktion → direktes UPDATE. teacher-lms/03 §2.9.
export const runtime = "nodejs";

interface ClosedRow {
  id: string;
  teacher_id: string;
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const denied = requireCron(req, requestId);
  if (denied) return denied;

  const svc = supabaseService();
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' UTC

  const { data: closed, error } = await svc
    .from("classes")
    .update({ archived_at: new Date().toISOString() })
    .lt("term_end", today)
    .is("archived_at", null)
    .select("id, teacher_id")
    .returns<ClosedRow[]>();
  if (error) {
    log("jobs/close-terms", { requestId, ok: false, err: error.message });
    return ok({ closed: 0 }, requestId);
  }

  for (const c of closed ?? []) {
    // Lead(s) informieren — mindestens die erstellende Lehrkraft.
    await svc.rpc("notify", {
      p_user: c.teacher_id,
      p_kind: "announcement",
      p_title: "Kurs archiviert (Term-Ende)",
      p_body: "Ein Kurs mit erreichtem Term-Ende wurde automatisch archiviert.",
      p_data: { classId: c.id },
    });
    await audit(svc, {
      action: "term.close",
      target: `classes:${c.id}`,
      meta: {},
    });
  }

  log("jobs/close-terms", { requestId, closed: (closed ?? []).length });
  return ok({ closed: (closed ?? []).length }, requestId);
}
