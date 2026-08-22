import { revalidatePath } from "next/cache";

/**
 * Pfadbasierte Invalidierung für die statisch erzeugten Seiten.
 *
 * Bewusst ohne Cache-Tags: Das Frontend liest über die Local API, nicht über
 * `fetch`, Tags würden also `use cache` voraussetzen. Pfade decken jeden Fall
 * hier ab und haben weniger bewegliche Teile.
 *
 * WICHTIG: greift nur bei Änderungen, die durch das eingebettete Admin bzw. die
 * Local API laufen. Direkte Schreibzugriffe auf die Datenbank lösen nichts aus.
 */

/** True, wenn der Aufruf aus dem Seed kommt — dann nicht revalidieren. */
export function skipRevalidate(context: unknown): boolean {
  const ctx = context as { seeding?: boolean; internal?: boolean } | undefined;
  return Boolean(ctx?.seeding || ctx?.internal);
}

/**
 * Layout-Invalidierung muss den Route-Gruppen-Pfad nennen.
 *
 * Next bildet die impliziten Cache-Tags aus dem UNNORMALISIERTEN Seitenpfad:
 * eine Doku-Seite trägt `_N_T_/(site)/dokumentation/layout`, während
 * `revalidatePath("/dokumentation", "layout")` den Tag
 * `_N_T_/dokumentation/layout` erzeugt — der auf nichts passt. Pfadbasierte
 * Aufrufe ohne "layout" sind davon nicht betroffen, die normalisiert Next.
 * Deshalb hier immer beide Schreibweisen; der zusätzliche Aufruf kostet nichts.
 */
function revalidateLayout(path: string) {
  safeRevalidate(`/(site)${path === "/" ? "" : path}`, "layout");
  safeRevalidate(path, "layout");
}

function safeRevalidate(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch (error) {
    // Außerhalb eines Next-Request-Kontexts (z. B. `payload run`) ist
    // revalidatePath nicht verfügbar. Das ist kein Fehlerfall — der Seed und
    // CLI-Skripte sollen daran nicht scheitern.
    console.warn(`[revalidate] ${path} übersprungen:`, (error as Error).message);
  }
}

export function revalidatePost(slug?: string | null, previousSlug?: string | null) {
  safeRevalidate("/blog");
  safeRevalidate("/sitemap.xml");
  if (slug) safeRevalidate(`/blog/${slug}`);
  if (previousSlug && previousSlug !== slug) safeRevalidate(`/blog/${previousSlug}`);
}

/** Autorendaten stehen auf der Übersicht und in jedem Artikel. */
export function revalidateAuthors() {
  revalidateLayout("/blog");
}

/** Navigation und Artikelzähler erscheinen auf jeder Doku-Seite. */
export function revalidateDocs() {
  revalidateLayout("/dokumentation");
  safeRevalidate("/sitemap.xml");
}

export function revalidatePricing() {
  safeRevalidate("/loesungen");
}

/** Header, Footer und die Bildplätze hängen überall am Global. */
export function revalidateSiteSettings() {
  revalidateLayout("/");
}
