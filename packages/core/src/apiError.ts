// Isomorphes Standard-Fehler-Envelope für alle /api-Routen (Trusted Server).
// `message` = deutscher, nutzerseitiger Text; `code` = maschinenlesbarer Schlüssel,
// auf den der Mobile-Client verzweigt. Rein plattform-agnostisch (nur `Response`,
// kein node:/next:) — läuft im Vercel-Node-Runtime, in Edge/Deno und (Typen) im Client.

export type ApiErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "payload_too_large"
  | "unsupported_media_type"
  | "upstream_error"
  | "internal_error";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export interface ApiErrorOptions {
  /** Korrelations-ID (aus lib/log.ts); fällt auf eine zufällige UUID zurück. */
  requestId?: string;
  details?: unknown;
  /** Sekunden bis zum nächsten Versuch → `Retry-After` + `RateLimit-Reset`. */
  retryAfter?: number;
  rateLimit?: { limit?: number; remaining?: number; reset?: number };
  /** Zusätzliche/überschreibende Header. */
  headers?: Record<string, string>;
}

function newRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback ohne WebCrypto (z.B. ältere Hermes-Runtime): ausreichend für Logs.
  return `req_${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/**
 * Baut eine `Response` mit dem Standard-Envelope. `Cache-Control: no-store` ist
 * auf allen /api-Fehlern gesetzt; bei 429 werden `Retry-After` + `RateLimit-*`
 * ergänzt. Der In-Stream-Fehler von /api/exam/grade behält seine Altform
 * `{"type":"error", ...}` und benutzt dieses Envelope NICHT.
 */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  opts: ApiErrorOptions = {}
): Response {
  const requestId = opts.requestId ?? newRequestId();
  const body: ApiErrorBody = {
    error: { code, message, requestId, ...(opts.details !== undefined ? { details: opts.details } : {}) },
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
  };
  if (opts.retryAfter !== undefined) {
    headers["Retry-After"] = String(Math.max(0, Math.ceil(opts.retryAfter)));
  }
  if (opts.rateLimit) {
    const { limit, remaining, reset } = opts.rateLimit;
    if (limit !== undefined) headers["RateLimit-Limit"] = String(limit);
    if (remaining !== undefined) headers["RateLimit-Remaining"] = String(remaining);
    if (reset !== undefined) headers["RateLimit-Reset"] = String(reset);
  }
  Object.assign(headers, opts.headers ?? {});
  return new Response(JSON.stringify(body), { status, headers });
}
