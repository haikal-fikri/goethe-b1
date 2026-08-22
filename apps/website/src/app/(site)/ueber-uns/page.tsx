import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ImageSlot } from "@/components/ImageSlot";
import { getSiteSettings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Über uns",
  description:
    "Das Digital Sprache Institut entstand aus der Arbeit in Integrations- und Abendkursen. Wir setzen KI dort ein, wo Rückmeldung Zeit kostet — ohne die Verantwortung an ein Modell abzugeben.",
  alternates: { canonical: "/ueber-uns" },
};

const principleCardStyle: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-1)",
  borderRadius: 20,
  padding: 26,
};

const principleTitleStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 19,
  fontWeight: 600,
  color: "var(--text-hi)",
  margin: "0 0 9px",
};

const principleTextStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.65,
  color: "var(--text-1)",
  margin: 0,
};

const bandHeadingStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 26,
  fontWeight: 600,
  color: "var(--text-hi)",
  margin: "0 0 16px",
};

export default async function AboutPage() {
  const settings = await getSiteSettings();

  return (
    <main>
      <section className="lp-sec" style={{ maxWidth: 1160, margin: "0 auto", padding: "76px 24px 40px" }}>
        <div className="lp-g2" style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 44, alignItems: "center" }}>
          <div>
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
              Über uns
            </div>
            <h1
              className="lp-h1s"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 48,
                fontWeight: 600,
                color: "var(--text-hi)",
                margin: "0 0 22px",
                letterSpacing: "-.025em",
                lineHeight: 1.1,
                maxWidth: "26ch",
                textWrap: "balance",
              }}
            >
              Wir bauen KI für den Unterricht, nicht für Dashboards.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--text-1)", margin: 0, maxWidth: "66ch" }}>
              Das Digital Sprache Institut entstand aus der Arbeit in Integrations- und
              Abendkursen. Der Engpass war immer derselbe: Schreiben und Sprechen brauchen
              Rückmeldung, und die kostet Lehrkräfte Abende. Wir setzen KI genau dort ein — für
              sofortiges Feedback bei Lernenden und schnellere Workflows bei Lehrkräften — ohne die
              Verantwortung an ein Modell abzugeben.
            </p>
          </div>
          <div className="lp-img400" style={{ borderRadius: 24, overflow: "hidden", border: "1px solid var(--border-1)", height: 400 }}>
            <ImageSlot
              slot="about-hero"
              placeholder="Bild: Team oder Unterrichtsraum (ca. 1040 × 800)"
              media={settings.imageSlots?.aboutHero}
              sizes="(max-width: 900px) 90vw, 500px"
              priority
            />
          </div>
        </div>
      </section>

      <section className="lp-sec" style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 24px 70px" }}>
        <div className="lp-g3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
          <div style={principleCardStyle}>
            <h2 style={principleTitleStyle}>Prüfungstreu</h2>
            <p style={principleTextStyle}>
              Wir erfinden keine eigenen Skalen. Aufgabentypen und Bewertungsraster folgen der
              Prüfung, auf die Ihre Kurse vorbereiten.
            </p>
          </div>
          <div style={principleCardStyle}>
            <h2 style={principleTitleStyle}>Lehrkraft zuletzt</h2>
            <p style={principleTextStyle}>
              Die KI übernimmt die Vorarbeit, die Entscheidung bleibt beim Menschen. Jede Abweichung
              wird dokumentiert, nicht versteckt.
            </p>
          </div>
          <div style={principleCardStyle}>
            <h2 style={principleTitleStyle}>Datensparsam</h2>
            <p style={principleTextStyle}>
              Wir erheben, was der Unterricht braucht. DSGVO-konforme Verarbeitung, Löschfristen im
              Produkt sichtbar, Export jederzeit.
            </p>
          </div>
        </div>
      </section>

      <section style={{ background: "var(--surface-alt)", borderTop: "1px solid var(--border-1)", borderBottom: "1px solid var(--border-1)" }}>
        <div
          className="lp-sec lp-g2"
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "56px 24px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 48,
          }}
        >
          <div>
            <h2 style={bandHeadingStyle}>Anbieter</h2>
            <div style={{ fontSize: 14.5, lineHeight: 1.8, color: "var(--text-1)" }}>
              Digital Sprache Institut
              <br />
              <span style={{ color: "var(--text-2)" }}>[Straße und Hausnummer]</span>
              <br />
              <span style={{ color: "var(--text-2)" }}>[PLZ, Ort]</span> · Deutschland
              <br />
              <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--text-2)", margin: "16px 0 0", maxWidth: "52ch" }}>
              Vertretungsberechtigte Person, Registereintrag und USt-IdNr. bitte für das Impressum
              ergänzen.
            </p>
          </div>
          <div>
            <h2 style={bandHeadingStyle}>Zusammenarbeit</h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--text-1)", margin: "0 0 18px", maxWidth: "52ch" }}>
              Wir entwickeln mit Sprachschulen, nicht an ihnen vorbei. Wenn Sie Deutschkurse geben
              und Ihre Korrekturpraxis einbringen möchten, sprechen wir gern.
            </p>
            <Link
              href="/kontakt"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 44,
                padding: "0 20px",
                borderRadius: 14,
                background: "var(--primary-btn-bg)",
                color: "var(--primary-btn-fg)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Kontakt aufnehmen
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
