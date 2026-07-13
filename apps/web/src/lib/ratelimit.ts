import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import {
  registerLimiters,
  rateLimitingEnabled,
  getRedis,
  enforce as baseEnforce,
  enforceAll,
  getClientIp,
  hkey,
  gradeBudgetHit,
  type EnforceResult,
  type MkFn,
} from "@repo/server";

// Web-App-Limiter-Registry (rl:api:*) — der geteilte Engine (@repo/server) hält
// enforce/enforceAll/getClientIp/hkey/gradeBudgetHit; DIESE Datei registriert die
// web-spezifische Limiter-Menge + Präfix. Schlüssel-Präfix `rl:api:*` grenzt die
// Web-App gegen teacher-web (`tb:*`) / admin (`tc:*`) auf einer geteilten Upstash-DB ab.

export {
  rateLimitingEnabled,
  getClientIp,
  hkey,
  gradeBudgetHit,
  enforceAll,
  type EnforceResult,
};

export type LimiterName =
  | "preAuthIp"
  | "gradeBurst" | "gradeHour" | "gradeDay" | "gradeIpDay"
  | "emailWin" | "emailDay"
  | "avatarUser"
  | "acctExport" | "acctDelete" | "resetProgress"
  | "otpEmail" | "otpIp"
  | "payCheckout";

registerLimiters((mk: MkFn) => ({
  preAuthIp:  mk("rl:api:preauth:ip",  Ratelimit.slidingWindow(60,  "1 m")),   // fail-CLOSED, alle /api
  gradeBurst: mk("rl:api:grade:burst", Ratelimit.slidingWindow(4,   "2 m")),
  gradeHour:  mk("rl:api:grade:hour",  Ratelimit.slidingWindow(6,   "1 h")),
  gradeDay:   mk("rl:api:grade:day",   Ratelimit.slidingWindow(15,  "24 h")),
  gradeIpDay: mk("rl:api:grade:ipday", Ratelimit.slidingWindow(120, "24 h")),
  emailWin:   mk("rl:api:email:win",   Ratelimit.slidingWindow(5,   "10 m")),
  emailDay:   mk("rl:api:email:day",   Ratelimit.slidingWindow(20,  "24 h")),
  avatarUser: mk("rl:api:avatar:user", Ratelimit.slidingWindow(5,   "1 h")),
  acctExport: mk("rl:api:acct:export", Ratelimit.slidingWindow(2,   "24 h")),
  acctDelete: mk("rl:api:acct:delete", Ratelimit.slidingWindow(3,   "24 h")),
  resetProgress: mk("rl:api:acct:reset", Ratelimit.slidingWindow(3, "1 h")),
  otpEmail:   mk("rl:api:otp:email",   Ratelimit.slidingWindow(3,   "10 m")),
  otpIp:      mk("rl:api:otp:ip",      Ratelimit.slidingWindow(15,  "10 m")),   // fail-CLOSED
  payCheckout: mk("rl:api:pay:ip",     Ratelimit.slidingWindow(10,  "10 m")),   // fail-CLOSED, per-IP
}));

/** Typed wrapper über den generischen enforce() (LimiterName-Sicherheit für Web-Routen). */
export function enforce(name: LimiterName, key: string, failClosed = false): Promise<EnforceResult> {
  return baseEnforce(name, key, failClosed);
}

// ======================================================================
//  Web-anonymer Pfad (rl:web:*) — mehrere Fenster pro Endpunkt, analytics:false.
//  Getrennt von der per-user-Registry oben; Präfixe rl:web:* isoliert.
// ======================================================================

type Kind = "grade" | "email";

let limiters: Record<Kind, Ratelimit[]> | null = null;
function getLimiters(): Record<Kind, Ratelimit[]> {
  if (limiters) return limiters;
  const r = getRedis();
  limiters = {
    grade: [
      new Ratelimit({ redis: r, limiter: Ratelimit.fixedWindow(1, "30 s"), prefix: "rl:web:grade:burst", analytics: false }),
      new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(3, "1 h"), prefix: "rl:web:grade:hour", analytics: false }),
      new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(10, "1 d"), prefix: "rl:web:grade:day", analytics: false }),
    ],
    email: [
      new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: "rl:web:email:hour", analytics: false }),
      new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(15, "1 d"), prefix: "rl:web:email:day", analytics: false }),
    ],
  };
  return limiters;
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * Prüft alle Fenster eines Endpunkts (kurz → lang), bricht beim ersten Treffer ab.
 * No-Op ohne Upstash. Fail-open bei Redis-Fehlern (Turnstile schützt weiterhin).
 */
export async function checkRateLimit(
  kind: Kind,
  identifier: string
): Promise<RateLimitResult> {
  if (!rateLimitingEnabled()) return { ok: true };
  try {
    for (const limiter of getLimiters()[kind]) {
      const res = await limiter.limit(identifier);
      if (!res.success) {
        const retryAfterSec = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
        return { ok: false, retryAfterSec };
      }
    }
    return { ok: true };
  } catch (err) {
    console.error("[ratelimit] Redis-Fehler — Anfrage wird durchgelassen:", err);
    return { ok: true };
  }
}
