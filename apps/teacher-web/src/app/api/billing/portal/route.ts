import { apiError } from "@repo/core";
import { requireTeacher, ok } from "@/lib/guard";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { createPortalUrl } from "@/lib/polar";

// POST /api/billing/portal — Polar CustomerPortal für das eigene Abo des
// Aufrufers (Upgrade/Downgrade/Kündigen/Karte). teacher-lms/05 §1.2.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;

  const rl = await enforce("portal", ctx.user.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  try {
    const url = await createPortalUrl({ userId: ctx.user.id });
    return ok({ url }, requestId);
  } catch (e) {
    log("billing/portal", { requestId, ok: false, err: String(e) });
    return apiError(503, "upstream_error", "Verwaltung derzeit nicht verfügbar.", { requestId });
  }
}
