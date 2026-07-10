import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import {
  registerLimiters,
  rateLimitingEnabled,
  enforce as baseEnforce,
  enforceAll,
  getClientIp,
  hkey,
  gradeBudgetHit,
  type EnforceResult,
  type MkFn,
} from "@repo/server";

// Vercel-B-Limiter-Registry (teacher-lms/03 §3). Der geteilte Engine (@repo/server)
// hält enforce/enforceAll; DIESE Datei registriert die teacher-spezifische Menge +
// Präfix `tb:*` (isoliert gegen web `rl:api:*` / admin `tc:*` auf geteilter Upstash-DB).
// Die Registry-Schlüssel-„preAuthIp" wird von requireUser() erwartet.

export { rateLimitingEnabled, getClientIp, hkey, gradeBudgetHit, enforceAll, type EnforceResult };

export type LimiterName =
  | "preAuthIp"
  | "otpIp" | "otpEmail"
  | "inviteBurst" | "inviteDay"
  | "classCreate" | "removeStudent" | "sessionCancel"
  | "assignSubmit" | "speakSubmit" | "whisperTeacher" | "gradeTeacher"
  | "onboarding" | "orgInvite"
  | "checkout" | "portal";

registerLimiters((mk: MkFn) => ({
  preAuthIp:     mk("tb:api:preauth:ip", Ratelimit.slidingWindow(60,  "1 m")),   // fail-CLOSED, alle B /api
  // Lehrkraft-Anmeldung (OTP-Proxy vor GoTrue): per-E-Mail 3/10 min + per-IP
  // 15/10 min (fail-CLOSED), spiegelt apps/web (mobile 11 §10.2).
  otpEmail:      mk("tb:api:otp:email",  Ratelimit.slidingWindow(3,   "10 m")),
  otpIp:         mk("tb:api:otp:ip",     Ratelimit.slidingWindow(15,  "10 m")),  // fail-CLOSED
  inviteBurst:   mk("tb:invite:burst",   Ratelimit.slidingWindow(20,  "10 m")),  // per teacher
  inviteDay:     mk("tb:invite:day",     Ratelimit.slidingWindow(200, "24 h")),  // email-bomb ceiling
  classCreate:   mk("tb:class:create",   Ratelimit.slidingWindow(10,  "10 m")),
  removeStudent: mk("tb:class:remove",   Ratelimit.slidingWindow(60,  "10 m")),
  sessionCancel: mk("tb:session:cancel", Ratelimit.slidingWindow(60,  "10 m")),
  assignSubmit:  mk("tb:assign:submit",  Ratelimit.slidingWindow(10,  "24 h")),  // per STUDENT, fail-OPEN behind grade_budget_hit
  speakSubmit:   mk("tb:speak:submit",   Ratelimit.slidingWindow(5,   "1 h")),   // fail-CLOSED + per-seat fair-use
  whisperTeacher: mk("tb:speak:whisper", Ratelimit.slidingWindow(60,  "1 h")),   // backstops transcribe_budget_hit
  gradeTeacher:  mk("tb:grade:teacher",  Ratelimit.slidingWindow(240, "10 m")),  // writing+speaking grade + exam-feedback
  onboarding:    mk("tb:onboarding",     Ratelimit.slidingWindow(20,  "24 h")),  // DPA accept + guardian consent
  orgInvite:     mk("tb:org:invite",     Ratelimit.slidingWindow(30,  "24 h")),  // Pro owner seat provisioning
  checkout:      mk("tb:billing:checkout", Ratelimit.slidingWindow(10, "1 h")),
  portal:        mk("tb:billing:portal", Ratelimit.slidingWindow(30,  "1 h")),
}));

/** Typed wrapper über den generischen enforce() (LimiterName-Sicherheit für B-Routen). */
export function enforce(name: LimiterName, key: string, failClosed = false): Promise<EnforceResult> {
  return baseEnforce(name, key, failClosed);
}
