// Öffentliche Client-Konfiguration. NUR EXPO_PUBLIC_* (zur Build-Zeit inlined) —
// niemals Secrets im Bundle (CI-Bundle-Audit erzwingt das).
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiBase: process.env.EXPO_PUBLIC_API_BASE ?? "",
  turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  // Dev-Override: Klasse-Tab lokal erzwingen, ohne das prod-Flag app_config.class_enabled
  // (über /api/config) zu kippen. Unset/beliebig ≠ "true" → prod-Default (aus).
  classEnabled: process.env.EXPO_PUBLIC_CLASS_ENABLED === "true",
} as const;

export const supabaseConfigured = () =>
  Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const apiConfigured = () => Boolean(env.apiBase);
export const googleConfigured = () => Boolean(env.googleWebClientId || env.googleIosClientId);
export const turnstileConfigured = () => Boolean(env.turnstileSiteKey);

// Auth-Redirect (Deep-Link) — muss in Supabase → URL Configuration erlaubt sein.
export const AUTH_REDIRECT = "b1trainer://auth-callback";
