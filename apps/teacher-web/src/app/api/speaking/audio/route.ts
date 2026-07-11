import { apiError } from "@repo/core";
import { requireTeacher, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { newRequestId, log } from "@/lib/log";
import { presignGet } from "@/lib/r2";

// GET /api/speaking/audio?submissionId=… — kurzlebige presigned-GET-URL, damit die
// Lehrkraft/TA die Aufnahme im Browser abspielen kann. Grader-gated (is_speaking_grader,
// wie /api/speaking/grade). Nach dem Purge (audio_key=null) → 410. teacher-lms/04 §4.
export const runtime = "nodejs";

interface SubRow {
  id: string;
  audio_key: string | null;
  status: string;
}

export async function GET(req: Request) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;

  const submissionId = new URL(req.url).searchParams.get("submissionId");
  if (!submissionId) return apiError(400, "bad_request", "submissionId fehlt.", { requestId });

  // Grader-Autorisierung (Lead/Creator/Owner ODER TA) über den NUTZER-Client — wie /grade.
  const { data: allowed, error: authErr } = await ctx.supabase.rpc("is_speaking_grader", {
    _submission: submissionId,
  });
  if (authErr || !allowed) {
    return apiError(403, "forbidden", "Kein Zugriff auf diese Aufnahme.", { requestId });
  }

  const svc = supabaseService();
  const { data: sub } = await svc
    .from("speaking_submissions")
    .select("id, audio_key, status")
    .eq("id", submissionId)
    .maybeSingle<SubRow>();
  if (!sub) return apiError(404, "not_found", "Aufnahme nicht gefunden.", { requestId });
  if (!sub.audio_key) {
    // 24 Std. nach der Bewertung purged der Cron das Objekt (Transkript bleibt).
    // Status 410 (der Client verzweigt darauf); Code aus dem ApiErrorCode-Enum.
    return apiError(410, "not_found", "Audio wurde bereits gelöscht (DSGVO-Aufbewahrung).", { requestId });
  }

  try {
    const url = await presignGet(sub.audio_key);
    log("speaking/audio", { requestId, submissionId, ok: true });
    return ok({ url }, requestId);
  } catch (e) {
    log("speaking/audio.presign", { requestId, submissionId, ok: false, err: String(e) });
    return apiError(503, "upstream_error", "Audio derzeit nicht verfügbar.", { requestId });
  }
}
