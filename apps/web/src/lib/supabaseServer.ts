import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { enforce, getClientIp } from "@/lib/ratelimit";

// Trusted-Server-Auth (backend/11 §0.2): 1) pre-auth per-IP-Gate (fail-closed)
// 2) lokaler exp/shape-Precheck (spart getUser bei Müll-Tokens) 3) getUser()
// (validiert Signatur + Revocation). Ohne Supabase-Env → null (unautorisiert),
// damit der anonyme Web-Pfad weiterläuft, bis Auth provisioniert ist.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only, NIE NEXT_PUBLIC_

export class RateLimitError extends Error {
  constructor(public retryAfterSec: number) {
    super("rate_limited");
    this.name = "RateLimitError";
  }
}

/** Lokaler JWT-Check: 3 Teile, exp in der Zukunft. KEINE Signaturprüfung (das macht getUser). */
function looksLikeUnexpiredJwt(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      exp?: number;
    };
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifiziert den Bearer-JWT. Wirft `RateLimitError`, wenn das pre-auth IP-Gate
 * greift; gibt `null` bei fehlendem/ungültigem Token (→ Aufrufer behandelt als
 * anonym). Der zurückgegebene `supabase`-Client ist RLS-scoped auf den Aufrufer.
 */
export async function requireUser(
  req: Request
): Promise<{ user: User; supabase: SupabaseClient } | null> {
  const ipGate = await enforce("preAuthIp", getClientIp(req), /* failClosed */ true);
  if (!ipGate.ok) throw new RateLimitError(ipGate.retryAfterSec);

  if (!URL || !ANON) return null; // Supabase-Auth noch nicht provisioniert
  const authz = req.headers.get("authorization") ?? "";
  if (!/^bearer\s+/i.test(authz)) return null;
  const token = authz.slice(7).trim();
  if (!looksLikeUnexpiredJwt(token)) return null;

  const supabase = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.aud !== "authenticated") return null;
  return { user: data.user, supabase };
}

export const hasRole = (u: User, r: "teacher" | "admin") =>
  ((u.app_metadata?.role as string | undefined) ?? "student") === r;

/** Service-Role-Client (RLS-Bypass) für privilegierte Writes. Nur wenn konfiguriert. */
export function supabaseService(): SupabaseClient {
  if (!URL || !SERVICE) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / URL ist nicht gesetzt.");
  }
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Anon-Client OHNE JWT (für den pre-session OTP-Proxy → GoTrue serverseitig). */
export function supabaseAnon(): SupabaseClient {
  if (!URL || !ANON) throw new Error("NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ist nicht gesetzt.");
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const supabaseAuthConfigured = () => Boolean(URL && ANON);
export const supabaseServiceConfigured = () => Boolean(URL && SERVICE);
