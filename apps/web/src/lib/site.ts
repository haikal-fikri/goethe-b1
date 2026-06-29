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
