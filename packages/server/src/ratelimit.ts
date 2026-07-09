import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import { sql } from "./db";

// ============================================================================
//  Shared rate-limit ENGINE (backend/11 §0.3, teacher-lms/03 §3).
//  App-agnostic: each app (web / teacher-web / admin) registers its OWN limiter
//  set + Redis key-prefix via `registerLimiters(builder)`; `enforce(name)` looks
//  it up here. The registry lives on globalThis (like db.ts's sql singleton) so
//  it survives any per-consumer module duplication the bundler might introduce.
//
//  Building limiters is LAZY (only when Upstash is configured) so an env-less
//  build/dev (no UPSTASH_*) never touches Redis — every enforce() short-circuits
//  on `rateLimitingEnabled()` before the registry is ever built.
// ============================================================================

export function rateLimitingEnabled(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// Lazy Redis singleton — analog zu resend.ts/stripe.ts. Erst gebaut, wenn
// Ratenbegrenzung aktiv ist, damit Build/Env-lose Umgebungen nicht scheitern.
let redis: Redis | null = null;
export function getRedis(): Redis {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL/TOKEN ist nicht gesetzt.");
  }
  redis = new Redis({ url, token });
  return redis;
}

/** Baut einen per-user-Limiter (analytics + ephemeralCache). Jedes Fenster braucht
 *  ein EIGENES `prefix`, sonst kollidieren die Redis-Zähler. */
export type MkFn = (
  prefix: string,
  limiter: ConstructorParameters<typeof Ratelimit>[0]["limiter"]
) => Ratelimit;

export const mk: MkFn = (prefix, limiter) =>
  new Ratelimit({ redis: getRedis(), prefix, limiter, analytics: true, ephemeralCache: new Map() });

export interface EnforceResult {
  ok: boolean;
  retryAfterSec: number;
  limit?: number;
  remaining?: number;
  reset?: number;
}

// Registry lebt auf globalThis → immun gegen Modul-Duplikation über Bundler-
// Grenzen. Der Builder wird beim Laden des app-eigenen ratelimit-Moduls gesetzt
// und erst beim ersten enforce() (mit aktivem Upstash) ausgewertet.
type Registry = Record<string, Ratelimit>;
const g = globalThis as unknown as {
  __rlRegistry?: { build: ((mk: MkFn) => Registry) | null; built: Registry | null };
};
g.__rlRegistry ??= { build: null, built: null };

/** Vom app-eigenen lib/ratelimit-Modul aufgerufen: registriert die Limiter-Menge
 *  (als Builder, damit das Bauen lazy bleibt und Redis nur bei Bedarf entsteht). */
export function registerLimiters(build: (mk: MkFn) => Registry): void {
  g.__rlRegistry!.build = build;
  g.__rlRegistry!.built = null;
}

function registry(): Registry {
  const slot = g.__rlRegistry!;
  if (slot.built) return slot.built;
  if (!slot.build) throw new Error("registerLimiters() wurde nie aufgerufen.");
  slot.built = slot.build(mk);
  return slot.built;
}

/**
 * Ein Limiter-Fenster prüfen. No-Op wenn Upstash nicht konfiguriert ist (Guard
 * VOR dem Bauen der Registry, damit env-lose Builds nicht Redis anfassen).
 * `failClosed=true` (Sicherheits-Limiter) → bei Redis-Fehler DENY; sonst ALLOW
 * (Kosten-Limiter; der fail-closed Postgres-Budget-Breaker deckelt die Kosten).
 */
export async function enforce(
  name: string,
  key: string,
  failClosed = false
): Promise<EnforceResult> {
  if (!rateLimitingEnabled()) return { ok: true, retryAfterSec: 0 };
  try {
    const limiter = registry()[name];
    if (!limiter) {
      console.error(`[ratelimit] unbekannter Limiter "${name}" (failClosed=${failClosed})`);
      return failClosed ? { ok: false, retryAfterSec: 60 } : { ok: true, retryAfterSec: 0 };
    }
    const res = await limiter.limit(key);
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

/**
 * Client-IP aus den von der Plattform gesetzten Headern. Auf Vercel überschreibt
 * der Edge-Proxy `x-forwarded-for`/`x-real-ip`, daher vertrauenswürdig (erster Hop
 * = Client). `cf-connecting-ip` wird bewusst NICHT gelesen. Fallback ist ein fester
 * Schlüssel (fail-closed) — niemals „durchlassen".
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
