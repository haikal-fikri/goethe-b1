import Link from "next/link";

/**
 * Inhalt der 404-Seite. Als eigene Komponente, weil mehrere
 * `not-found.tsx`-Grenzen sie zeigen (siehe unten) — der Text steht dadurch
 * nur einmal im Code.
 *
 * Hintergrund: Ein `not-found.tsx` in der Wurzel einer Route-Gruppe ist für
 * Next die GLOBALE 404-Grenze. Weil diese App zwei Root-Layouts hat ((site)
 * und (payload)), kann Next dort keines von beiden anwenden und rendert eine
 * eingebaute Minimal-Seite: ohne `lang`, ohne Stylesheet, ohne Kopf- und
 * Fußzeile. Verschachtelte `not-found.tsx` (in /blog, /dokumentation und der
 * Auffang-Route) werden dagegen normal mit dem (site)-Layout zusammengesetzt —
 * deshalb liegt die Datei dort und nicht nur in der Gruppenwurzel.
 */
export function NotFoundContent() {
  return (
    <main className="lp-sec" style={{ maxWidth: 1160, margin: "0 auto", padding: "110px 24px 120px" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".13em",
          textTransform: "uppercase",
          color: "var(--text-2)",
          marginBottom: 14,
        }}
      >
        Fehler 404
      </div>
      <h1
        className="lp-h1s"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 44,
          fontWeight: 600,
          color: "var(--text-hi)",
          margin: "0 0 16px",
          letterSpacing: "-.022em",
          lineHeight: 1.1,
        }}
      >
        Diese Seite gibt es nicht.
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--text-1)", margin: "0 0 28px", maxWidth: "52ch" }}>
        Möglicherweise wurde sie verschoben oder der Link ist veraltet.
      </p>
      <div className="lp-btnrow" style={{ display: "flex", gap: 12 }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 48,
            padding: "0 22px",
            borderRadius: 15,
            background: "var(--gruen)",
            color: "#fff",
            fontSize: 14.5,
            fontWeight: 600,
            boxShadow: "var(--glow-gruen)",
          }}
        >
          Zur Startseite
        </Link>
        <Link
          href="/dokumentation"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 48,
            padding: "0 22px",
            borderRadius: 15,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-1)",
            color: "var(--text-hi)",
            fontSize: 14.5,
            fontWeight: 600,
          }}
        >
          Dokumentation
        </Link>
      </div>
    </main>
  );
}
