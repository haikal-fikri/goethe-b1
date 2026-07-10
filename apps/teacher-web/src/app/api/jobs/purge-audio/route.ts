import { ok, requireCron } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { newRequestId, log } from "@/lib/log";
import { deleteObject } from "@/lib/r2";
import { audit } from "@/lib/audit";

// POST /api/jobs/purge-audio — stündlich. Fällige Audios (audio_purge_at < now)
// aus R2 löschen → audio_key=null (status unverändert, Transkript überlebt).
// audit_log 'audio.purge' (NIE den Key/PII). teacher-lms/03 §2.9, /04 §4.
export const runtime = "nodejs";

interface DueRow {
  id: string;
  audio_key: string;
  created_at: string;
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const denied = requireCron(req, requestId);
  if (denied) return denied;

  const svc = supabaseService();
  const nowIso = new Date().toISOString();
  const { data: due } = await svc
    .from("speaking_submissions")
    .select("id, audio_key, created_at")
    .lt("audio_purge_at", nowIso)
    .not("audio_key", "is", null)
    .limit(500)
    .returns<DueRow[]>();

  let purged = 0;
  let failed = 0;
  for (const row of due ?? []) {
    try {
      await deleteObject(row.audio_key); // R2 (Phase-6-Seam); wirft bis zur Verdrahtung
      await svc.from("speaking_submissions").update({ audio_key: null }).eq("id", row.id);
      await audit(svc, {
        action: "audio.purge",
        target: `speaking_submissions:${row.id}`,
        meta: {
          ageH: Math.round((Date.now() - new Date(row.created_at).getTime()) / 3600000),
        },
      });
      purged++;
    } catch (e) {
      failed++;
      log("jobs/purge-audio.delete", { requestId, id: row.id, ok: false, err: String(e) });
    }
  }

  log("jobs/purge-audio", { requestId, purged, failed });
  return ok({ purged, failed }, requestId);
}
