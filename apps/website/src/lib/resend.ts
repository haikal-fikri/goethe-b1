import "server-only";
import { Resend } from "resend";

// Lazy-Singleton wie in apps/web: erst beim ersten Versand instanziiert, damit
// der Build (und jede Seite ohne E-Mail) nicht am fehlenden Key scheitert.
let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY ist nicht gesetzt.");
  cached = new Resend(key);
  return cached;
}

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Zeilenumbrüche entfernen — Schutz vor Header-Injection. */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

// ACHTUNG: Der Resend-Sandbox-Absender (onboarding@resend.dev) stellt nur an die
// Adresse des Kontoinhabers zu. Für echten Versand eine eigene Domain in Resend
// verifizieren und RESEND_FROM_EMAIL darauf setzen.
export const RESEND_FROM = sanitizeHeader(
  process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"
);
export const RESEND_FROM_NAME = sanitizeHeader(
  process.env.RESEND_FROM_NAME ?? "Digital Sprache Institut"
);

export const RESEND_FROM_HEADER = `${RESEND_FROM_NAME} <${RESEND_FROM}>`;
