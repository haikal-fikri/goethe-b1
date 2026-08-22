import Link from "next/link";
import type { CSSProperties } from "react";

type Props = {
  lernenUrl: string;
  contactEmail: string;
};

const columnStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };

const headingStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: ".11em",
  textTransform: "uppercase",
  color: "var(--text-2)",
  marginBottom: 4,
};
// Optik unverändert; die Zeilenhöhe hebt die Trefferfläche auf ein für den
// Finger brauchbares Maß (der Entwurf lag bei 16px).
const linkStyle: CSSProperties = {
  fontSize: 13.5,
  color: "var(--text-1)",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
};

export function Footer({ lernenUrl, contactEmail }: Props) {
  return (
    <footer style={{ background: "var(--surface-alt)", borderTop: "1px solid var(--border-1)" }}>
      <div
        className="lp-foot"
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "52px 24px 30px",
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
          gap: 40,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "var(--gruen)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 32px",
              }}
            >
              <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 16, color: "#fff", lineHeight: 1 }}>
                DS
              </span>
            </div>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-hi)" }}>
              Digital Sprache Institut
            </span>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--text-1)", margin: 0, maxWidth: "38ch" }}>
            Prüfungstraining Deutsch für Lernende und Lehrkräfte.
          </p>
        </div>

        <div style={columnStyle}>
          <div style={headingStyle}>Produkt</div>
          <Link className="foot-link" href="/loesungen" style={linkStyle}>Lösungen</Link>
          <Link className="foot-link" href="/loesungen" style={linkStyle}>Preise</Link>
          <a className="foot-link" href={lernenUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            Lernen ↗<span className="sr-only"> (öffnet in neuem Tab)</span>
          </a>
        </div>

        <div style={columnStyle}>
          <div style={headingStyle}>Institut</div>
          <Link className="foot-link" href="/ueber-uns" style={linkStyle}>Über uns</Link>
          <Link className="foot-link" href="/kontakt" style={linkStyle}>Kontakt</Link>
          <a className="foot-link" href={`mailto:${contactEmail}`} style={linkStyle}>{contactEmail}</a>
        </div>

        <div style={columnStyle}>
          <div style={headingStyle}>Ressourcen</div>
          <Link className="foot-link" href="/blog" style={linkStyle}>Blog</Link>
          <Link className="foot-link" href="/dokumentation" style={linkStyle}>Dokumentation</Link>
        </div>

        <div style={columnStyle}>
          <div style={headingStyle}>Rechtliches</div>
          <Link className="foot-link" href="/datenschutz" style={linkStyle}>Datenschutz</Link>
          <Link className="foot-link" href="/agb" style={linkStyle}>AGB</Link>
          <Link className="foot-link" href="/cookie-richtlinie" style={linkStyle}>Cookie-Richtlinie</Link>
        </div>
      </div>

      <div
        className="lp-row-wrap lp-padx"
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "18px 24px 40px",
          borderTop: "1px solid var(--border-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
          © 2026 Digital Sprache Institut. Alle Rechte vorbehalten.
        </span>
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>DSGVO-konforme Datenverarbeitung</span>
      </div>
    </footer>
  );
}
