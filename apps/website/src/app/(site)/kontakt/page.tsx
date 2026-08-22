import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ContactForm } from "@/components/ContactForm";
import { getSiteSettings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Demo anfragen",
  description:
    "Erzählen Sie kurz von Ihren Kursen — wir melden uns innerhalb eines Werktags mit einem Terminvorschlag.",
  alternates: { canonical: "/kontakt" },
};

const asideCardStyle: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-1)",
  borderRadius: 20,
  padding: 24,
};

const asideLabelStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: ".11em",
  textTransform: "uppercase",
  color: "var(--text-2)",
  marginBottom: 12,
};

const asideTextStyle: CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.7,
  color: "var(--text-1)",
  margin: 0,
};

export default async function ContactPage() {
  const settings = await getSiteSettings();

  return (
    <main>
      <section
        className="lp-sec lp-g2"
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "76px 24px 90px",
          display: "grid",
          gridTemplateColumns: "1fr .85fr",
          gap: "0 56px",
          alignItems: "start",
        }}
      >
        <div style={{ gridColumn: "1/-1", marginBottom: 34 }}>
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
            Kontakt
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
            Demo anfragen
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--text-1)", margin: 0, maxWidth: "52ch" }}>
            Erzählen Sie kurz von Ihren Kursen — wir melden uns innerhalb eines Werktags mit einem
            Terminvorschlag.
          </p>
        </div>

        <div>
          <ContactForm contactEmail={settings.contactEmail} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...asideCardStyle, background: "var(--surface-alt)" }}>
            <div style={asideLabelStyle}>Direkt</div>
            <div style={{ fontSize: 14.5, lineHeight: 1.9, color: "var(--text-1)" }}>
              <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
              <br />
              <span style={{ color: "var(--text-2)" }}>Mo–Fr, 9–17 Uhr</span>
            </div>
          </div>
          <div style={asideCardStyle}>
            <div style={asideLabelStyle}>Datenschutz</div>
            <p style={asideTextStyle}>
              Fragen zu Auftragsverarbeitung, Löschfristen oder TOMs beantworten wir mit Unterlagen —
              nennen Sie im Formular einfach „Datenschutz“.
            </p>
          </div>
          <div style={asideCardStyle}>
            <div style={asideLabelStyle}>Für Lernende</div>
            <p style={{ ...asideTextStyle, marginBottom: 14 }}>
              Sie üben mit der App und haben eine Frage zum Konto?
            </p>
            <a
              href={settings.lernenUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13.5, fontWeight: 600 }}
            >
              lernen.digi-s.institute ›<span className="sr-only"> (öffnet in neuem Tab)</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
