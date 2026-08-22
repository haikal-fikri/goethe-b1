import type { ReactNode } from "react";

/**
 * Rahmen der drei Rechtstexte. Die Typografie (h3, h4, p, ul, code) kommt aus
 * der Klasse `.lp-legal` in globals.css — wörtlich aus dem Design.
 *
 * ACHTUNG: Alle drei Texte sind Entwürfe („Entwurf zur juristischen Prüfung")
 * und enthalten Platzhalter. Vor dem Launch juristisch prüfen lassen.
 */
export function LegalShell({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <main className="lp-legal lp-sec" style={{ maxWidth: 1160, margin: "0 auto", padding: "70px 24px 90px" }}>
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
        Rechtliches
      </div>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 40,
          fontWeight: 600,
          color: "var(--text-hi)",
          margin: "0 0 10px",
          letterSpacing: "-.022em",
        }}
      >
        {title}
      </h1>
      <p style={{ color: "var(--text-2)" }}>{status}</p>
      {children}
    </main>
  );
}
