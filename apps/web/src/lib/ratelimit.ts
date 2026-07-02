import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import { sql } from "@/lib/db";

// Per-IP-Ratenbegrenzung gegen Missbrauch der teuren KI-Endpunkte.
// Speicher: Upstash Redis (zustandslos über REST — kein Verbindungspool,
// funktioniert in serverless/Node). Aktiv NUR, wenn beide Upstash-Env-Variablen
// gesetzt sind; sonst No-Op (lokale Entwicklung ohne Upstash läuft normal).
//
// Schlüssel-Präfix `rl:web:*` grenzt die Web-App gegen die spätere Mobile-App ab,
// falls beide dieselbe Upstash-DB teilen (oder Mobile bekommt eine eigene DB —
// dann ändert sich nur die Env, nicht der Code).

export function rateLimitingEnabled(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// Lazy-Singleton — analog zu resend.ts/stripe.ts. Wird erst gebaut, wenn
// Ratenbegrenzung aktiv ist, damit Build/Env-lose Umgebungen nicht scheitern.
let redis: Redis | null = null;
function getRedis(): Redis {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL/TOKEN ist nicht gesetzt.");
  }
  redis = new Redis({ url, token });
  return redis;
}

type Kind = "grade" | "email";

// Mehrere Fenster pro Endpunkt. WICHTIG: jedes Limit braucht ein EIGENES `prefix`,
// sonst teilen sich die Fenster denselben Redis-Schlüssel und verfälschen die Zähler.
// `analytics: false` spart zusätzliche Redis-Befehle (kein Dashboard nötig).
// Reihenfolge kurz → lang; der Aufrufer bricht beim ersten Treffer ab.
let limiters: Record<Kind, Ratelimit[]> | null = null;
function getLimiters(): Record<Kind, Ratelimit[]> {
  if (limiters) return limiters;
  const r = getRedis();
  limiters = {
    grade: [
      new Ratelimit({
        redis: r,
        limiter: Ratelimit.fixedWindow(1, "30 s"),
        prefix: "rl:web:grade:burst",
        analytics: false,
      }),
      new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        prefix: "rl:web:grade:hour",
        analytics: false,
      }),
      new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(10, "1 d"),
        prefix: "rl:web:grade:day",
        analytics: false,
      }),
    ],
    email: [
      new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(5, "1 h"),
        prefix: "rl:web:email:hour",
        analytics: false,
      }),
      new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(15, "1 d"),
        prefix: "rl:web:email:day",
        analytics: false,
      }),
    ],
  };
  return limiters;
}

/**
 * Client-IP aus den von der Plattform gesetzten Headern. Auf Vercel überschreibt
 * der Edge-Proxy `x-forwarded-for`/`x-real-ip`, daher sind sie vertrauenswürdig
 * (erster/linkester Hop = Client). `cf-connecting-ip` wird bewusst NICHT gelesen:
 * ohne Cloudflare-Proxy davor wäre es rein client-kontrolliert und trivial fälschbar.
 * Fallback ist ein fester Schlüssel (fail-closed) — niemals „durchlassen“.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "ip:unknown";
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * Prüft alle Fenster eines Endpunkts (kurz → lang) und bricht beim ersten
 * überschrittenen Limit ab — so verbraucht ein 30-s-Burst-Treffer (Doppelklick)
 * KEINEN der knappen Stunden-/Tages-Slots. No-Op, wenn Upstash nicht konfiguriert
 * ist. Fail-open bei Redis-Fehlern: ein Upstash-Ausfall darf die Bewertung nicht
 * lahmlegen (Turnstile schützt in diesem Fenster weiterhin gegen Bots).
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
        const retryAfterSec = Math.max(
          1,
          Math.ceil((res.reset - Date.now()) / 1000)
        );
        return { ok: false, retryAfterSec };
      }
    }
    return { ok: true };
  } catch (err) {
    console.error("[ratelimit] Redis-Fehler — Anfrage wird durchgelassen:", err);
    return { ok: true };
  }
}

// ======================================================================
//  Pro-user-Registry (Mobile-Pfad) + fail-closed-Primitiven (backend/11 §0.3)
//  Getrennt vom obigen web-anonymen checkRateLimit; Präfixe rl:api:* isoliert.
// ======================================================================

export type LimiterName =
  | "preAuthIp"
  | "gradeBurst" | "gradeHour" | "gradeDay" | "gradeIpDay"
  | "emailWin" | "emailDay"
  | "avatarUser"
  | "acctExport" | "acctDelete" | "resetProgress"
  | "otpEmail" | "otpIp";

let registry: Record<LimiterName, Ratelimit> | null = null;
function getRegistry(): Record<LimiterName, Ratelimit> {
  if (registry) return registry;
  const r = getRedis();
  const mk = (prefix: string, limiter: ConstructorParameters<typeof Ratelimit>[0]["limiter"]) =>
    new Ratelimit({ redis: r, prefix, limiter, analytics: true, ephemeralCache: new Map() });
  registry = {
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
  };
  return registry;
}

export interface EnforceResult {
  ok: boolean;
  retryAfterSec: number;
  limit?: number;
  remaining?: number;
  reset?: number;
}

/**
 * Ein Limiter-Fenster prüfen. No-Op wenn Upstash nicht konfiguriert ist.
 * `failClosed=true` (Sicherheits-Limiter) → bei Redis-Fehler DENY; sonst ALLOW
 * (Kosten-Limiter; der fail-closed Postgres-Budget-Breaker §gradeBudgetHit deckelt).
 */
export async function enforce(
  name: LimiterName,
  key: string,
  failClosed = false
): Promise<EnforceResult> {
  if (!rateLimitingEnabled()) return { ok: true, retryAfterSec: 0 };
  try {
    const res = await getRegistry()[name].limit(key);
    const retryAfterSec = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    return res.success
      ? { ok: true, retryAfterSec: 0, limit: res.limit, remaining: res.remaining, reset: res.reset }
      : { ok: false, retryAfterSec, limit: res.limit, remaining: res.remaining, reset: res.reset };
  } catch (err) {
    console.error(`[ratelimit] ${name} Redis-Fehler (failClosed=${failClosed}):`, err);
    return failClosed ? { ok: false, retryAfterSec: 60 } : { ok: true, retryAfterSec: 0 };
  }
}

/** Mehrere Limiter cheapest-first; bricht beim ersten Block ab. */
export async function enforceAll(
  steps: Array<() => Promise<EnforceResult>>
): Promise<EnforceResult> {
  for (const step of steps) {
    const r = await step();
    if (!r.ok) return r;
  }
  return { ok: true, retryAfterSec: 0 };
}

/** Pseudonymisierender Schlüssel-Hash (E-Mail/IP) fürs Limiten/Loggen. */
export function hkey(s: string): string {
  return createHash("sha256").update(s.toLowerCase()).digest("base64url").slice(0, 24);
}

/**
 * Globaler, Redis-unabhängiger Groq-Budget-Breaker (Postgres, FAIL-CLOSED).
 * Deckelt die Kosten über ALLE Bewertungen (authed + anonym). Bei DB-Fehler:
 * limited=true (deny) — unbegrenzte Kosten sind nicht akzeptabel.
 */
export async function gradeBudgetHit(): Promise<{ limited: boolean; retryAfterSec: number }> {
  try {
    const rows = await sql<{ limited: boolean; retry_after: number }[]>`
      select limited, retry_after from public.grade_budget_hit()
    `;
    const r = rows[0];
    return { limited: r?.limited ?? true, retryAfterSec: r?.retry_after ?? 60 };
  } catch (err) {
    console.error("[grade-budget] DB-Fehler → fail-closed:", err);
    return { limited: true, retryAfterSec: 60 };
  }
}
