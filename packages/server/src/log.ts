import "server-only";
import { createHash, randomUUID } from "node:crypto";

// Strukturiertes Logging OHNE Secrets/volle PII (backend/12 §8).
// Erlaubt: user.id, resultId, route, status, latency, model, thirdUsed,
// rate-limit-outcome, error-class. Verboten: JWTs, Keys, voller answer_text,
// Transkripte, Audio-Keys, presigned URLs, rohe E-Mails (mit hkey hashen).

/** Korrelations-ID pro Request. */
export function newRequestId(): string {
  return randomUUID();
}

/** Pseudonymisierender Hash für E-Mail/IP im Log (nie die Rohwerte loggen). */
export function hkey(s: string): string {
  return createHash("sha256").update(s.toLowerCase()).digest("base64url").slice(0, 24);
}

// Felder, die NIE geloggt werden (auch nicht redigiert). Der Teacher-LMS-Delta
// (backend/12 §8 → teacher-lms/03 §5.1) ergänzt Transkript/Audio-Key/Presign-URLs.
const FORBIDDEN_KEYS = new Set([
  "answer", "essay", "answer_text", "email", "jwt", "token", "authorization",
  "transcript", "audioKey", "audio_key", "password", "secret",
  "presignedUrl", "signedUrl", "korrekturen",
]);
// Token-/Key-Muster, die aus String-Werten redigiert werden.
const SECRET_RE =
  /(eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,})|(sk_[A-Za-z0-9]{8,})|(bearer\s+\S+)/gi;

function redact(v: unknown): unknown {
  if (typeof v === "string") return v.replace(SECRET_RE, "[redacted]");
  return v;
}

/** Eine JSON-Zeile; verbotene Felder werden verworfen, Werte redigiert. */
export function log(area: string, fields: Record<string, unknown> = {}): void {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    safe[k] = redact(v);
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ t: new Date().toISOString(), area, ...safe }));
}
