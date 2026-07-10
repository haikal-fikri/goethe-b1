import { z } from "zod";
import { apiError } from "@repo/core";
import { getClientIp, enforce, hkey } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { supabaseAnon, supabaseAuthConfigured } from "@/lib/supabaseServer";
import { log, newRequestId } from "@/lib/log";

export const runtime = "nodejs";

// Gehärteter Proxy vor GoTrue signInWithOtp (Superadmin-Login). per-E-Mail
// 3/10 min + per-IP 15/10 min (fail-closed) + Turnstile. Rolle 'admin' wird
// NICHT hier vergeben (nur via /api/admin/grant-role bzw. Bootstrap-SQL) — der
// Login mintet nur die Session; ohne admin-Claim greifen alle C-Routen 403.
const schema = z.object({
  email: z.email(),
  turnstileToken: z.string().optional(),
});

export async function POST(request: Request) {
  const requestId = newRequestId();
  if (!supabaseAuthConfigured()) {
    return apiError(503, "internal_error", "Anmeldung derzeit nicht verfügbar.", { requestId });
  }

  const ip = getClientIp(request);
  const ipGate = await enforce("otpIp", ip, /* failClosed */ true);
  if (!ipGate.ok) {
    return apiError(429, "rate_limited", "Zu viele Versuche. Bitte kurz warten.", { requestId, retryAfter: ipGate.retryAfterSec });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "bad_request", "Ungültige Anfrage.", { requestId });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(422, "validation_failed", "Ungültige E-Mail.", { requestId });
  const { email, turnstileToken } = parsed.data;

  const emailGate = await enforce("otpEmail", hkey(email));
  if (!emailGate.ok) {
    return apiError(429, "rate_limited", "Zu viele Codes an diese Adresse. Bitte später erneut.", { requestId, retryAfter: emailGate.retryAfterSec });
  }

  if (process.env.OTP_TURNSTILE_DISABLED !== "true") {
    if (!(await verifyTurnstile(turnstileToken, ip))) {
      return apiError(403, "forbidden", "Bitte bestätige, dass du kein Roboter bist.", { requestId });
    }
  }

  // shouldCreateUser:false — ein Superadmin-Konto wird NIE über den Login
  // angelegt (Rolle wird separat vergeben); unbekannte E-Mails laufen ins Leere.
  const { error } = await supabaseAnon().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    log("auth/otp", { requestId, ok: false, emailHash: hkey(email), err: error.message });
    return apiError(502, "upstream_error", "Code konnte nicht gesendet werden. Bitte erneut versuchen.", { requestId });
  }
  log("auth/otp", { requestId, ok: true, emailHash: hkey(email) });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
