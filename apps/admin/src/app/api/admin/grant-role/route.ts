import { apiError, grantRoleSchema } from "@repo/core";
import { requireAdmin, parseJson, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { audit } from "@/lib/audit";

// POST /api/admin/grant-role — die gefährlichste Route (Selbst-Eskalation zu admin).
// Aufrufer MUSS bereits admin sein; grantRole 5/Tag FAIL-CLOSED; jeder Aufruf
// auditiert. Der/die Ziel-User muss sich neu anmelden (app_metadata beim Token-Mint).
// Der erste admin wird von Hand im Supabase-Dashboard gesetzt. teacher-lms/05 §5.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ctx = await requireAdmin(req, requestId);
  if (ctx instanceof Response) return ctx;

  // FAIL-CLOSED: ein Redis-Ausfall darf die Privileg-Eskalation nicht öffnen.
  const rl = await enforce("grantRole", ctx.user.id, /* failClosed */ true);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Rollen-Änderungen. Bitte später erneut.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  const parsed = await parseJson(req, grantRoleSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { targetUserId, role } = parsed;

  const svc = supabaseService();
  const { error } = await svc.auth.admin.updateUserById(targetUserId, {
    app_metadata: { role },
  });
  if (error) {
    log("admin/grant-role", { requestId, ok: false, err: error.message });
    return apiError(500, "internal_error", "Rolle konnte nicht gesetzt werden.", { requestId });
  }

  await audit(svc, {
    actor: ctx.user.id,
    action: "role.grant",
    target: `user:${targetUserId}`,
    meta: { role, via: "admin" },
  });

  log("admin/grant-role", { requestId, role, ok: true });
  return ok({ ok: true }, requestId);
}
