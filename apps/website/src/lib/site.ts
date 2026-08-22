/**
 * Öffentliche Basis-URL. Ohne Env-Variable der Dev-Server.
 *
 * Fehlt sie im Produktions-Build, landen localhost-Adressen in Canonicals,
 * og:url, sitemap.xml, robots.txt und JSON-LD — unbrauchbar und schwer zu
 * bemerken. Deshalb hier eine deutliche Warnung beim Build.
 */
if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === "production") {
  console.warn(
    "\n[website] NEXT_PUBLIC_SITE_URL ist nicht gesetzt — Canonicals, sitemap.xml\n" +
      "[website] und JSON-LD zeigen auf http://localhost:3003. Vor dem Deploy setzen.\n"
  );
}

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3003"
).replace(/\/+$/, "");

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Fällt auf den Namen der Einrichtung zurück, wenn eine Angabe fehlt. */
export const SITE_NAME = "Digital Sprache Institut";
export const SITE_TAGLINE = "Prüfungstraining Deutsch";
