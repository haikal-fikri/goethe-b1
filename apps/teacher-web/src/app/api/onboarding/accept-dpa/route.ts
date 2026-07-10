import { apiError, acceptDpaSchema } from "@repo/core";
import { requireTeacher, parseJson, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { enforce, getClientIp, hkey } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { audit } from "@/lib/audit";
import { CURRENT_DPA_VERSION } from "@/lib/compliance";

// POST /api/onboarding/accept-dpa — DPA-Zustimmung festhalten (Lawful-Basis-Gate:
// invite + Klassenerstellung prüfen teacher_dpa_ok). IP nur GEHASHT. teacher-lms/03 §2.10.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;

  const parsed = await parseJson(req, acceptDpaSchema, requestId);
  if (parsed instanceof Response) return parsed;

  const rl = await enforce("onboarding", ctx.user.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  const svc = supabaseService();
  const { error } = await svc.from("teacher_agreements").upsert(
    {
      teacher_id: ctx.user.id,
      dpa_version: CURRENT_DPA_VERSION,
      ip_hash: hkey(getClientIp(req)), // nur der Hash, nie die rohe IP
    },
    { onConflict: "teacher_id,dpa_version", ignoreDuplicates: true }
  );
  if (error) {
    log("onboarding/accept-dpa.persist", { requestId, ok: false, err: error.message });
    return apiError(500, "internal_error", "Zustimmung konnte nicht gespeichert werden.", { requestId });
  }

  await audit(svc, {
    actor: ctx.user.id,
    action: "dpa.accept",
    target: `user:${ctx.user.id}`,
    meta: { dpa_version: CURRENT_DPA_VERSION },
  });

  log("onboarding/accept-dpa", { requestId, ok: true });
  return ok({ accepted: true, dpaVersion: CURRENT_DPA_VERSION }, requestId);
}
