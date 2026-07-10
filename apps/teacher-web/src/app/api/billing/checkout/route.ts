import { apiError, checkoutSchema } from "@repo/core";
import { requireTeacher, parseJson, ok } from "@/lib/guard";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { createCheckoutUrl } from "@/lib/polar";

// POST /api/billing/checkout — server-initiiert; die authentifizierte user.id +
// der Plan werden SERVERSEITIG in die Polar-Metadata gestempelt (der Webhook
// vertraut NUR darauf). teacher-lms/05 §1.2.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;

  const parsed = await parseJson(req, checkoutSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { plan } = parsed;

  const rl = await enforce("checkout", ctx.user.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  const successUrl = new URL("/billing/done", req.url).toString();
  try {
    const url = await createCheckoutUrl({ plan, userId: ctx.user.id, successUrl });
    return ok({ url }, requestId);
  } catch (e) {
    log("billing/checkout", { requestId, ok: false, err: String(e) });
    return apiError(503, "upstream_error", "Bezahlung derzeit nicht verfügbar.", { requestId });
  }
}
