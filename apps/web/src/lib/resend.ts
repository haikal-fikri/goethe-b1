import { Resend } from "resend";

// Lazy-Singleton: erst beim ersten Aufruf instanziiert, damit der Build (und
// Routen ohne E-Mail-Versand) nicht am fehlenden Key scheitern. Wirft eine klare
// Meldung, falls RESEND_API_KEY fehlt — analog zum Stripe-/GROQ-Guard.
let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY ist nicht gesetzt.");
  }
  cached = new Resend(key);
  return cached;
}

// Zeilenumbrüche entfernen — Schutz vor Header-Injection, falls eine Env-Variable
// kompromittiert ist oder versehentlich CR/LF enthält.
function sanitizeHeader(v: string): string {
  return v.replace(/[\r\n]+/g, " ").trim();
}

// Absender — konfigurierbar über Env. Standard ist der Resend-Sandbox-Absender
// (onboarding@resend.dev). ACHTUNG: Der Sandbox-Absender liefert nur an die
// E-Mail-Adresse des Resend-Kontoinhabers aus. Für echten Versand an Dritte
// (z.B. die Lehrkraft) eine eigene Domain in Resend verifizieren und
// RESEND_FROM_EMAIL auf eine Adresse dieser Domain setzen.
export const RESEND_FROM = sanitizeHeader(
  process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"
);
export const RESEND_FROM_NAME = sanitizeHeader(
  process.env.RESEND_FROM_NAME ?? "B1+Trainer"
);

/** Absender im Format `"B1+Trainer <onboarding@resend.dev>"`. */
export const RESEND_FROM_HEADER = `${RESEND_FROM_NAME} <${RESEND_FROM}>`;
