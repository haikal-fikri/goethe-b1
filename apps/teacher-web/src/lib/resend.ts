import "server-only";
import { Resend } from "resend";

// Lazy-Singleton (Port aus apps/web/src/lib/resend.ts): erst beim ersten Versand
// instanziiert, damit der Build + versandlose Routen nicht am fehlenden Key
// scheitern. Invite-/Seat-Mails sind BEST-EFFORT — ein Resend-Ausfall darf den
// Invite-Insert nicht zurückrollen (der join_code/token funktioniert trotzdem).
let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY ist nicht gesetzt.");
  cached = new Resend(key);
  return cached;
}

/** CR/LF entfernen — Header-Injection-Schutz (teacher-lms/03 §2.1: From-Header strippen). */
function sanitizeHeader(v: string): string {
  return v.replace(/[\r\n]+/g, " ").trim();
}

// Absender — Standard ist der Resend-Sandbox-Absender (liefert NUR an den
// Konto-Inhaber). Für echten Versand an Lehrkräfte/Schüler eine Domain in Resend
// verifizieren + RESEND_FROM_EMAIL setzen.
export const RESEND_FROM = sanitizeHeader(
  process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"
);
export const RESEND_FROM_NAME = sanitizeHeader(
  process.env.RESEND_FROM_NAME ?? "B1+Trainer"
);
export const RESEND_FROM_HEADER = `${RESEND_FROM_NAME} <${RESEND_FROM}>`;
