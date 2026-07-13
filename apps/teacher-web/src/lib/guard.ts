import "server-only";
// Seiteneffekt-Import: registriert die tb:*-Limiter (inkl. preAuthIp), die
// requireUser() erwartet, BEVOR eine Route requireUser aufruft.
import "@/lib/ratelimit";
import { hasRole, requireUser, RateLimitError } from "@/lib/supabaseServer";
import { apiError } from "@repo/core";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ZodType } from "zod";

// Gemeinsamer Preflight für alle Vercel-B-Routen (teacher-lms/03 §2 „Common
// preflight order"): preAuthIp (in requireUser, fail-closed) → requireUser →
// hasRole. Jede Helfer-Funktion gibt entweder den Kontext ODER eine fertige
// Fehler-`Response` zurück (Aufrufer: `if (x instanceof Response) return x;`).

export interface AuthCtx {
  user: User;
  supabase: SupabaseClient; // RLS-scoped auf den Aufrufer (NICHT service-role)
}

/** requireUser + Umsetzung von RateLimitError→429 / fehlender Auth→401. */
export async function authenticate(
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
  return auth;
}

/** authenticate + Lehrer-Rolle (JWT app_metadata.role). Ownership prüft die Route. */
export async function requireTeacher(
  req: Request,
  requestId: string
): Promise<AuthCtx | Response> {
  const ctx = await authenticate(req, requestId);
  if (ctx instanceof Response) return ctx;
  if (!hasRole(ctx.user, "teacher")) {
    return apiError(403, "forbidden", "Nur Lehrkräfte.", { requestId });
  }
  return ctx;
}

/** Body lesen + zod. Gibt die geparsten Daten ODER 400/422 zurück. */
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

/** Erfolgs-JSON mit no-store + X-Request-Id (Spiegel zu apiError). */
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

/** Konstant-Zeit-Vergleich für Cron-Secrets (teacher-lms/03 §2.9). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Cron-Guard: `Authorization: Bearer $CRON_SECRET_B`, konstant-Zeit. */
export function requireCron(req: Request, requestId: string): Response | null {
  const secret = process.env.CRON_SECRET_B;
  const authz = req.headers.get("authorization") ?? "";
  const token = /^bearer\s+/i.test(authz) ? authz.slice(7).trim() : "";
  if (!secret || !token || !timingSafeEqual(token, secret)) {
    return apiError(401, "unauthorized", "Nicht autorisiert.", { requestId });
  }
  return null;
}
