import * as AppleAuthentication from "expo-apple-authentication";
import { getSupabase } from "./supabase";
import { env, apiConfigured } from "./env";

// Auth-Methoden. Primär: Magic-Link + Google/Apple idToken (nonce-gebunden).
// Fallback: 8-stellige E-Mail-OTP über den /api/auth/otp-Proxy (per-E-Mail/IP +
// Turnstile serverseitig), danach verifyOtp client-seitig.

export class AuthError extends Error {}

/** OTP/Magic-Link anfordern — geht über den gehärteten Vercel-Proxy. */
export async function sendEmailOtp(email: string, turnstileToken?: string): Promise<void> {
  if (!apiConfigured()) throw new AuthError("API nicht konfiguriert.");
  const res = await fetch(`${env.apiBase}/api/auth/otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, turnstileToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new AuthError(body?.error?.message ?? "Code konnte nicht gesendet werden.");
  }
}

/** 8-stelligen Code verifizieren → Session. */
export async function verifyEmailOtp(email: string, token: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new AuthError("Supabase nicht konfiguriert.");
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw new AuthError(error.message);
}

// Google-Anmeldung ist in v1 nicht verdrahtet (kein OAuth-Client konfiguriert →
// Button ist ausgeblendet, siehe googleConfigured()). Das native Modul
// (@react-native-google-signin) wird erst wieder eingebunden, wenn ein Google-
// OAuth-Client eingerichtet ist (es zieht sonst AppCheckCore/GoogleUtilities-Pods).
export async function signInWithGoogle(): Promise<void> {
  throw new AuthError("Google-Anmeldung ist derzeit nicht verfügbar.");
}

export async function signInWithApple(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new AuthError("Supabase nicht konfiguriert.");
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!cred.identityToken) throw new AuthError("Kein Apple-Token erhalten.");
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: cred.identityToken,
  });
  if (error) throw new AuthError(error.message);
}

export const appleAvailable = AppleAuthentication.isAvailableAsync;
