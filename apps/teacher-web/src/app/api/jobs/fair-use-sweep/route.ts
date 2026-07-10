import { ok, requireCron } from "@/lib/guard";
import { fairUseStatus, PRO_FAIR_USE_CEILINGS } from "@repo/core";
import { supabaseService } from "@/lib/supabaseServer";
import { newRequestId, log } from "@/lib/log";
import { audit } from "@/lib/audit";

// POST /api/jobs/fair-use-sweep — nächtlich. usage_counters (aktueller Zeitraum)
// je Pro-Teacher lesen; ≥100 % einer Grenze → audit 'fairuse.flag' (Ratios, KEINE
// PII). MUTIERT NIE entitlements/plan/Arbeit. teacher-lms/03 §2.9, /05 §3.3.
// ⚠️ OWNER-CONFIRM: die eigentliche Owner-Benachrichtigung (E-Mail/Slack) braucht
// einen Alert-Kanal; hier nur der durable audit_log-Trail + Log.
export const runtime = "nodejs";

interface EntRow {
  user_id: string;
}
interface UsageRow {
  teacher_id: string;
  graded_audio_seconds: number;
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const denied = requireCron(req, requestId);
  if (denied) return denied;

  const svc = supabaseService();
  const period = new Date().toISOString().slice(0, 7); // 'YYYY-MM' UTC

  const { data: proTeachers } = await svc
    .from("entitlements")
    .select("user_id")
    .eq("kind", "teacher_subscription")
    .eq("plan", "pro")
    .eq("status", "active")
    .returns<EntRow[]>();

  let flagged = 0;
  for (const t of proTeachers ?? []) {
    const { data: usage } = await svc
      .from("usage_counters")
      .select("teacher_id, graded_audio_seconds")
      .eq("teacher_id", t.user_id)
      .eq("period", period)
      .maybeSingle<UsageRow>();
    const fu = fairUseStatus(
      { activeStudents: 0, classes: 0, gradedAudioSeconds: Number(usage?.graded_audio_seconds ?? 0) },
      PRO_FAIR_USE_CEILINGS
    );
    if (fu.alert) {
      flagged++;
      await audit(svc, {
        actor: t.user_id,
        action: "fairuse.flag",
        target: `user:${t.user_id}`,
        meta: { period, ratios: fu.ratios, breaches: fu.breaches },
      });
    }
  }

  log("jobs/fair-use-sweep", { requestId, checked: (proTeachers ?? []).length, flagged });
  return ok({ flagged }, requestId);
}
