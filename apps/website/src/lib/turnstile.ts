import "server-only";

// Server-seitige Verifikation von Cloudflare Turnstile für das Kontaktformular.
// Gleiche Konvention wie apps/web und apps/teacher-web.
//
// Aktiv NUR, wenn TURNSTILE_SECRET_KEY gesetzt ist — ohne Keys läuft die
// lokale Entwicklung normal weiter.
//
// ACHTUNG: NEXT_PUBLIC_TURNSTILE_SITE_KEY (Client) und TURNSTILE_SECRET_KEY
// (Server) gehören zusammen — beide setzen oder keins. Nur das Secret zu setzen
// würde jede Anfrage abweisen, weil der Client dann kein Token mitschickt.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Gibt `true` zurück, wenn die Anfrage zugelassen werden soll.
 * - deaktiviert (kein Secret) → true (Dev-Skip)
 * - kein Token → false (fail-closed)
 * - Cloudflare antwortet `success:false` → false (Token ungültig oder verbraucht)
 * - Cloudflare nicht erreichbar → true (fail-open auf Infrastruktur-Ebene; in
 *   diesem seltenen Fenster deckelt die Ratenbegrenzung den Missbrauch)
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip?: string
): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token) return false;

  const secret = process.env.TURNSTILE_SECRET_KEY as string;
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "ip:unknown") body.set("remoteip", ip);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as SiteverifyResponse;
    if (!data.success) {
      console.warn("[turnstile] Verifikation fehlgeschlagen:", data["error-codes"] ?? []);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[turnstile] siteverify nicht erreichbar — lasse durch:", error);
    return true;
  }
}
