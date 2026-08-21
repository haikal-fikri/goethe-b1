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

  // Die bisherige Rolle vorher lesen: `updateUserById` ERSETZT app_metadata.role,
  // vergibt also nicht additiv. „teacher" an ein Admin-Konto ist damit eine
  // Herabstufung — das gehört ins Protokoll und in die Antwort.
  const { data: ziel } = await svc.auth.admin.getUserById(targetUserId);
  const vorher = (ziel?.user?.app_metadata?.role as string | undefined) ?? "student";

  // Protokoll VOR der Mutation. Die Rollenvergabe ist ein GoTrue-Aufruf und
  // lässt sich nicht mit dem Insert in eine Transaktion legen; schlägt das
  // Protokollieren hinterher fehl, wäre die Eskalation bereits passiert und
  // nicht mehr zuzuordnen. Fail-closed in dieser Reihenfolge heißt: keine
  // Rollenänderung ohne Protokolleintrag. Scheitert danach die Mutation, steht
  // ein Eintrag zu einem Vorgang im Log, der nicht stattgefunden hat — die
  // deutlich harmlosere der beiden Abweichungen, und sie wird unten vermerkt.
  const protokolliert = await audit(svc, {
    actor: ctx.user.id,
    action: "role.grant",
    target: `user:${targetUserId}`,
    meta: { role, vorher, herabstufung: vorher === "admin" && role !== "admin", via: "admin" },
  });
  if (!protokolliert) {
    log("admin/grant-role", { requestId, ok: false, err: "audit_failed" });
    return apiError(
      500,
      "internal_error",
      "Die Änderung konnte nicht protokolliert werden und wurde deshalb nicht ausgeführt.",
      { requestId }
    );
  }

  const { error } = await svc.auth.admin.updateUserById(targetUserId, {
    app_metadata: { role },
  });
  if (error) {
    log("admin/grant-role", { requestId, ok: false, err: error.message });
    await audit(svc, {
      actor: ctx.user.id,
      action: "role.grant.failed",
      target: `user:${targetUserId}`,
      meta: { role, via: "admin" },
    });
    return apiError(500, "internal_error", "Rolle konnte nicht gesetzt werden.", { requestId });
  }

  log("admin/grant-role", { requestId, role, vorher, ok: true });
  return ok({ ok: true, vorher }, requestId);
}
