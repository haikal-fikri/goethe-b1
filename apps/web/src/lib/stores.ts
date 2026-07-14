/**
 * Store-Links der mobilen App (apps/mobile, Bundle-ID/Package `de.b1trainer.app`).
 *
 * Bewusst NICHT in lib/site.ts: die Seitenleiste (PublicShell) ist eine
 * Client-Component. lib/site.ts leitet `siteUrl` u.a. aus
 * VERCEL_PROJECT_PRODUCTION_URL ab — einer server-seitigen Variable, die im
 * Client-Bundle zu `undefined` kollabiert. Getrennte Module verhindern, dass
 * jemand später versehentlich `siteUrl` im Client liest (und in Produktion
 * "http://localhost:3000" bekommt) oder lib/site.ts mit `server-only` markiert
 * und damit die Seitenleiste bricht.
 *
 * PLATZHALTER — die App ist noch nicht veröffentlicht:
 * · Play Store: die URL ergibt sich aus dem Android-Package und stimmt bereits,
 *   funktioniert aber erst nach der Veröffentlichung.
 * · App Store: braucht die numerische App-ID, die es erst nach dem ersten
 *   App-Store-Connect-Eintrag gibt.
 *
 * Beim Launch hier ersetzen oder per NEXT_PUBLIC_* überschreiben — die
 * Oberfläche liest sie ausschließlich von hier.
 */
export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL ??
  "https://apps.apple.com/app/id0000000000";

export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ??
  "https://play.google.com/store/apps/details?id=de.b1trainer.app";
