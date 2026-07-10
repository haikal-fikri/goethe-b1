import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import {
  registerLimiters,
  rateLimitingEnabled,
  enforce as baseEnforce,
  enforceAll,
  getClientIp,
  hkey,
  type EnforceResult,
  type MkFn,
} from "@repo/server";

// Vercel-C-Limiter-Registry (teacher-lms/03 §3). Präfix `tc:*` (isoliert gegen
// web `rl:api:*` / teacher `tb:*`). Registry-Schlüssel „preAuthIp" → requireUser().
export { rateLimitingEnabled, getClientIp, hkey, enforceAll, type EnforceResult };

export type LimiterName = "preAuthIp" | "otpIp" | "otpEmail" | "corpusWrite" | "grantRole";

registerLimiters((mk: MkFn) => ({
  preAuthIp:  mk("tc:api:preauth:ip", Ratelimit.slidingWindow(60,  "1 m")),   // fail-CLOSED, alle C /api
  // Superadmin-Anmeldung (OTP-Proxy vor GoTrue): per-E-Mail 3/10 min + per-IP
  // 15/10 min (fail-CLOSED), spiegelt apps/web + teacher-web.
  otpEmail:   mk("tc:api:otp:email",  Ratelimit.slidingWindow(3,   "10 m")),
  otpIp:      mk("tc:api:otp:ip",     Ratelimit.slidingWindow(15,  "10 m")),  // fail-CLOSED
  corpusWrite: mk("tc:corpus:write",  Ratelimit.slidingWindow(120, "10 m")),  // per admin
  grantRole:  mk("tc:role:grant",     Ratelimit.slidingWindow(5,   "24 h")),  // per admin, TIGHT (privilege escalation)
}));

/** Typed wrapper über den generischen enforce() (LimiterName-Sicherheit für C-Routen). */
export function enforce(name: LimiterName, key: string, failClosed = false): Promise<EnforceResult> {
  return baseEnforce(name, key, failClosed);
}
