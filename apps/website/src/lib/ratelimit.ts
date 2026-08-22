import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import {
  enforce,
  enforceAll,
  hkey,
  rateLimitingEnabled,
  registerLimiters,
  type EnforceResult,
  type MkFn,
} from "@repo/server";

/**
 * Limiter-Registry der Website (`rl:site:*`).
 *
 * Die Engine liegt in @repo/server; hier steht nur die app-eigene Limiter-Menge
 * samt Schlüssel-Präfix. Das Präfix grenzt die Website auf der geteilten
 * Upstash-Datenbank gegen die anderen Apps ab (`rl:api:*` Web, `tb:*`
 * Lehrkraft-Portal, `tc:*` Admin).
 *
 * Ohne UPSTASH_*-Variablen ist die Begrenzung deaktiviert (`enforce` gibt
 * sofort ok zurück) — Dev und Builds ohne Env laufen dadurch normal.
 */
registerLimiters((mk: MkFn) => ({
  contactIpBurst: mk("rl:site:contact:ip:burst", Ratelimit.slidingWindow(5, "10 m")),
  contactIpDay: mk("rl:site:contact:ip:day", Ratelimit.slidingWindow(20, "24 h")),
  contactEmailDay: mk("rl:site:contact:email:day", Ratelimit.slidingWindow(5, "24 h")),
}));

export { enforce, enforceAll, hkey, rateLimitingEnabled };
export type { EnforceResult };

/**
 * Client-IP in einer Server Action. Spiegelt `getClientIp` aus @repo/server,
 * das ein Request-Objekt erwartet — in einer Action gibt es nur `headers()`.
 * Auf Vercel überschreibt der Edge-Proxy `x-forwarded-for`, der erste Eintrag
 * ist also der Client. Fällt auf einen festen Schlüssel zurück, statt
 * durchzulassen.
 */
export function clientIpFromHeaders(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headerList.get("x-real-ip")?.trim();
  if (real) return real;
  return "ip:unknown";
}
