import { notFound } from "next/navigation";

/**
 * Fängt jede Adresse ab, die auf keine andere Route passt, und zeigt die
 * deutsche 404-Seite aus `(site)/not-found.tsx` — mit Kopf- und Fußzeile und
 * dem korrekten Status 404.
 *
 * Warum nicht `global-not-found.tsx`? Die App hat zwei Root-Layouts (`(site)`
 * und `(payload)`); für genau diesen Fall sieht Next `app/global-not-found.tsx`
 * samt `experimental.globalNotFound` vor. Das ist aber nur im Webpack-Build
 * verdrahtet — dieses Projekt baut mit Turbopack, dort bleibt die Datei
 * wirkungslos (nachgeprüft mit Next 16.2.7: Die Route taucht nicht im
 * app-paths-manifest auf). Ohne diese Route lieferte Next seine eingebaute
 * englische Seite „404: This page could not be found."
 *
 * Konkretere Routen gewinnen weiterhin: /admin und /api liegen in `(payload)`,
 * /blog/… und /dokumentation/… haben eigene Segmente.
 */
export default function CatchAllNotFound(): never {
  notFound();
}
