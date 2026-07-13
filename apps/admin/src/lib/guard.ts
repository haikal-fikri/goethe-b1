import "server-only";
// Seiteneffekt: registriert die tc:*-Limiter (inkl. preAuthIp) vor requireUser.
import "@/lib/ratelimit";
import { hasRole, requireUser, RateLimitError } from "@/lib/supabaseServer";
import { apiError } from "@repo/core";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ZodType } from "zod";

// Preflight für die Vercel-C-Admin-Routen: preAuthIp (fail-closed) → requireUser →
// hasRole(admin). DB-Reads sind zusätzlich RLS-gated durch is_admin(). teacher-lms/03 §0.2.

export interface AuthCtx {
  user: User;
  supabase: SupabaseClient;
}

export async function requireAdmin(
  req: Request,
  requestId: string
): Promise<AuthCtx | Response> {
  let auth: AuthCtx | null;
  try {
    auth = await requireUser(req);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return apiError(429, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.", {
        requestId,
        retryAfter: e.retryAfterSec,
      });
    }
    throw e;
  }
  if (!auth) return apiError(401, "unauthorized", "Nicht autorisiert.", { requestId });
  if (!hasRole(auth.user, "admin")) {
    return apiError(403, "forbidden", "Nur Administratoren.", { requestId });
  }
  return auth;
}

export async function parseJson<T>(
  req: Request,
  schema: ZodType<T>,
  requestId: string
): Promise<T | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "bad_request", "Ungültige Anfrage.", { requestId });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Interne Feldnamen/Validierungsstruktur nur außerhalb der Produktion preisgeben.
    return apiError(422, "validation_failed", "Ungültige Eingabe.", {
      requestId,
      ...(process.env.NODE_ENV !== "production"
        ? { details: parsed.error.flatten() }
        : {}),
    });
  }
  return parsed.data;
}

export function ok(data: unknown, requestId: string, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}
