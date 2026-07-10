import "server-only";

// Server-seitige Verifikation von Cloudflare Turnstile (Bot-/Mensch-Prüfung auf
// dem Superadmin-Login / OTP-Proxy). Aktiv NUR, wenn TURNSTILE_SECRET_KEY gesetzt
// ist — sonst wird übersprungen (lokale Entwicklung ohne Keys läuft normal).
//
// ACHTUNG: NEXT_PUBLIC_TURNSTILE_SITE_KEY (Client) und TURNSTILE_SECRET_KEY
// (Server) gehören zusammen — beide setzen oder keins.

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

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
  } catch (err) {
    console.error("[turnstile] siteverify nicht erreichbar — lasse durch:", err);
    return true;
  }
}
