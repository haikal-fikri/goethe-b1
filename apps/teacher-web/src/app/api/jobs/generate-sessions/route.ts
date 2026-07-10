import { apiError } from "@repo/core";
import { requireCron, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { newRequestId, log } from "@/lib/log";

// POST /api/jobs/generate-sessions — wöchentlich. Materialisiert Sitzungen für
// aktive Zeitpläne bis current_date+42 (idempotent via uq_class_sessions_sched).
// teacher-lms/03 §2.9.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = newRequestId();
  const denied = requireCron(req, requestId);
  if (denied) return denied;

  const svc = supabaseService();
  const { data, error } = await svc.rpc("generate_sessions", {});
  if (error) {
    log("jobs/generate-sessions", { requestId, ok: false, err: error.message });
    return apiError(500, "internal_error", "Sitzungen konnten nicht erzeugt werden.", { requestId });
  }
  log("jobs/generate-sessions", { requestId, generated: data, ok: true });
  return ok({ generated: data ?? 0 }, requestId);
}
