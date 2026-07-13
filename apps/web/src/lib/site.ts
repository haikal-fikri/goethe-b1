// Einzige Quelle für die absolute Basis-URL der Seite — genutzt von robots.ts,
// sitemap.ts und metadataBase (layout.tsx). Keine fest verdrahtete Domain:
// 1. NEXT_PUBLIC_SITE_URL (eigene Domain, später in .env/Vercel setzen)
// 2. VERCEL_PROJECT_PRODUCTION_URL (auf Vercel automatisch gesetzt)
// 3. localhost (lokale Entwicklung)
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/**
 * Store-Links der mobilen App (apps/mobile, Bundle-ID/Package `de.b1trainer.app`).
 *
 * PLATZHALTER — die App ist noch nicht veröffentlicht:
 * · Play Store: die URL ergibt sich aus dem Android-Package und stimmt bereits,
 *   funktioniert aber erst nach der Veröffentlichung.
 * · App Store: braucht die numerische App-ID, die es erst nach dem ersten
 *   App-Store-Connect-Eintrag gibt → hier vorerst die Entwickler-Suche.
 *
 * Beim Launch beide Werte hier ersetzen (oder per NEXT_PUBLIC_* überschreiben) —
 * die Oberfläche liest sie ausschließlich von hier.
 */
export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL ??
  "https://apps.apple.com/app/id0000000000";

export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ??
  "https://play.google.com/store/apps/details?id=de.b1trainer.app";
