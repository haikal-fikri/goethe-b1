// Einzige Quelle für die absolute Basis-URL der Seite — genutzt von robots.ts,
// sitemap.ts und metadataBase (layout.tsx). Keine fest verdrahtete Domain:
// 1. NEXT_PUBLIC_SITE_URL (eigene Domain, später in .env/Vercel setzen)
// 2. VERCEL_PROJECT_PRODUCTION_URL (auf Vercel automatisch gesetzt)
// 3. localhost (lokale Entwicklung)
// Produktion: https://lernen.digi-s.institute (via NEXT_PUBLIC_SITE_URL in Vercel).
//
// Diese Konstante ist NICHT nur Kosmetik — sie landet sichtbar in:
//   · /robots.txt        (Sitemap-Zeile)
//   · /sitemap.xml       (jede <loc>)
//   · metadataBase       (kanonische URLs, OG/Twitter-Bilder)
//   · der Ergebnis-E-Mail (renderExamResultEmail zeigt sie als Link an)
// Ohne NEXT_PUBLIC_SITE_URL greift der Vercel-Fallback: VERCEL_PROJECT_PRODUCTION_URL
// ist die *kürzeste* Produktions-Domain des Projekts — heute die richtige, aber sie
// kippt still auf eine andere, sobald eine kürzere Domain hinzukommt. Darum explizit setzen.
//
// Store-Links liegen bewusst in lib/stores.ts (client-safe) — siehe dort.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
