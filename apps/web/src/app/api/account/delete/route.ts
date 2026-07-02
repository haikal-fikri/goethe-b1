import { apiError } from "@repo/core";
import {
  requireUser,
  RateLimitError,
  supabaseService,
  supabaseServiceConfigured,
} from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { log, newRequestId } from "@/lib/log";

export const runtime = "nodejs";

// DSAR-Löschung (R2-aware): (1) Storage-Objekte des Nutzers löschen,
// (2) auth.admin.deleteUser → FK-Cascade entfernt alle DB-Zeilen. In v1 gibt es
// kein Audio (R2 no-op). Reauth ist client-seitig zu erzwingen; serverseitig
// gültiger JWT + enge Ratenbegrenzung (3/Tag).
export async function POST(request: Request) {
  const requestId = newRequestId();
  let auth: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    auth = await requireUser(request);
  } catch (e) {
    if (e instanceof RateLimitError) return apiError(429, "rate_limited", "Zu viele Anfragen.", { requestId, retryAfter: e.retryAfterSec });
    throw e;
  }
  if (!auth) return apiError(401, "unauthorized", "Nicht autorisiert.", { requestId });
  if (!supabaseServiceConfigured()) return apiError(503, "internal_error", "Löschen derzeit nicht verfügbar.", { requestId });

  const g = await enforce("acctDelete", auth.user.id);
  if (!g.ok) return apiError(429, "rate_limited", "Zu viele Löschanfragen.", { requestId, retryAfter: g.retryAfterSec });

  const uid = auth.user.id;
  const service = supabaseService();

  // (1) Avatar-Objekt entfernen (best-effort; verlässt sich NIE auf Cascade für Storage).
  await service.storage.from("avatars").remove([`${uid}/current.webp`]).catch(() => {});
  // (v1: kein R2-Audio → keine weiteren Objekte)

  // (2) Auth-User löschen → DB-Zeilen kaskadieren via FK on delete cascade.
  const { error } = await service.auth.admin.deleteUser(uid);
  if (error) {
    log("account/delete", { requestId, userId: uid, ok: false, err: error.message });
    return apiError(502, "upstream_error", "Konto konnte nicht gelöscht werden.", { requestId });
  }

  log("account/delete", { requestId, userId: uid, ok: true });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
