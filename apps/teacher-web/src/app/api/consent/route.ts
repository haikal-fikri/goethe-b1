import { apiError, consentSchema } from "@repo/core";
import { authenticate, parseJson, ok } from "@/lib/guard";
import { hasRole, supabaseService } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { audit } from "@/lib/audit";

// POST /api/consent — Erziehungsberechtigten-Stimmeinwilligung. studentId
// weggelassen ⇒ Guardian-self (auth.uid()); gesetzt ⇒ Lehrkraft im Namen (braucht
// Lehrer-Rolle + app_teacher_can_read). Speaking submit/finalize erzwingen
// guardian_consent_ok. teacher-lms/03 §2.10.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ctx = await authenticate(req, requestId);
  if (ctx instanceof Response) return ctx;

  const parsed = await parseJson(req, consentSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { studentId, status, method } = parsed;

  const rl = await enforce("onboarding", ctx.user.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  const targetStudent = studentId ?? ctx.user.id;

  // Im Namen eines Schülers: nur Lehrkraft mit Lese-Berechtigung (Papierbeleg).
  if (targetStudent !== ctx.user.id) {
    if (!hasRole(ctx.user, "teacher")) {
      return apiError(403, "forbidden", "Nur die eigene Einwilligung oder eine Lehrkraft.", { requestId });
    }
    const { data: canRead } = await ctx.supabase.rpc("app_teacher_can_read", { _student: targetStudent });
    if (!canRead) {
      return apiError(403, "forbidden", "Keine Berechtigung für diese:n Schüler:in.", { requestId });
    }
  }

  const svc = supabaseService();
  const { error } = await svc.from("guardian_consents").upsert(
    {
      student_id: targetStudent,
      status,
      method,
      recorded_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id" }
  );
  if (error) {
    log("consent.persist", { requestId, ok: false, err: error.message });
    return apiError(500, "internal_error", "Einwilligung konnte nicht gespeichert werden.", { requestId });
  }

  await audit(svc, {
    actor: ctx.user.id,
    action: "consent.record",
    target: `user:${targetStudent}`,
    meta: { status, method, onBehalf: targetStudent !== ctx.user.id },
  });

  log("consent", { requestId, status, onBehalf: targetStudent !== ctx.user.id });
  return ok({ recorded: true, status }, requestId);
}
