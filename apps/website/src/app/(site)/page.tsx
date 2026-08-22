import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CtaCard } from "@/components/CtaCard";
import { ImageSlot } from "@/components/ImageSlot";
import { LaptopIcon, PhoneIcon, SparkleIcon } from "@/components/icons";
import { getSiteSettings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "KI-gestütztes Deutschlernen für Prüfungserfolg",
  description:
    "Lernende trainieren mit KI-Feedback in Echtzeit für Schreiben, Sprechen, Lesen und Hören im echten Prüfungsformat. Lehrkräfte bereiten ihre Kurse mit KI-gestützten Workflows vor.",
  alternates: { canonical: "/" },
};

const cardStyle: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-1)",
  borderRadius: 20,
  padding: 24,
};

const cardTitleStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 20,
  fontWeight: 600,
  color: "var(--text-hi)",
  margin: "0 0 9px",
};

const cardTextStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.65,
  color: "var(--text-1)",
  margin: 0,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".13em",
  textTransform: "uppercase",
  color: "var(--text-2)",
  marginBottom: 12,
};

const statNumberStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 28,
  fontWeight: 600,
  color: "var(--text-hi)",
  lineHeight: 1,
};

const statLabelStyle: CSSProperties = { fontSize: 12.5, color: "var(--text-2)", marginTop: 5 };

const stepNumberStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--gruen)",
  width: 30,
  flex: "0 0 30px",
};

const stepTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "var(--text-hi)",
  margin: "0 0 6px",
};

const stepTextStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.65,
  color: "var(--text-1)",
  margin: 0,
  maxWidth: "56ch",
};

export default async function HomePage() {
  const settings = await getSiteSettings();
  const slots = settings.imageSlots;

  return (
    <main>
      <section
        className="lp-hero"
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "86px 24px 74px",
          display: "grid",
          gridTemplateColumns: "1.06fr .94fr",
          gap: 56,
          alignItems: "center",
        }}
      >
        <div>
          <div
            className="lp-eyebrow"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              padding: "6px 12px 6px 8px",
              borderRadius: 999,
              background: "var(--gruen-tint)",
              color: "var(--gruen)",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "var(--gruen)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
              }}
            >
              ✓
            </span>
            KI-gestütztes Training nach Goethe- &amp; ÖSD-Kriterien
          </div>
          <h1
            className="lp-h1"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 60,
              lineHeight: 1.04,
              fontWeight: 600,
              color: "var(--text-hi)",
              letterSpacing: "-.025em",
              margin: "0 0 22px",
              textWrap: "balance",
            }}
          >
            KI-gestütztes Deutschlernen — für Prüfungserfolg bei Lernenden und Lehrkräften.
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: "var(--text-1)",
              maxWidth: "52ch",
              margin: "0 0 32px",
              textWrap: "pretty",
            }}
          >
            Lernende trainieren mit KI-Feedback in Echtzeit für Schreiben, Sprechen, Lesen und Hören
            im echten Prüfungsformat. Lehrkräfte bereiten ihre Kurse mit KI-gestützten Workflows vor
            — von der Aufgabe bis zur Korrektur.
          </p>
          <div className="lp-btnrow" style={{ display: "flex", gap: 12, marginBottom: 38 }}>
            <Link
              href="/loesungen"
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
              Lösung ansehen
            </Link>
            <Link
              href="/kontakt"
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
              Demo für Ihre Schule
            </Link>
          </div>
          <div
            className="lp-stats"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "22px 40px",
              paddingTop: 26,
              borderTop: "1px solid var(--border-1)",
              maxWidth: 420,
            }}
          >
            <div>
              <div style={statNumberStyle}>4</div>
              <div style={statLabelStyle}>Prüfungsteile abgedeckt</div>
            </div>
            <div>
              <div style={statNumberStyle}>&lt; 60 s</div>
              <div style={statLabelStyle}>bis zur KI-Bewertung</div>
            </div>
            <div>
              <div style={statNumberStyle}>DSGVO</div>
              <div style={statLabelStyle}>konform verarbeitet</div>
            </div>
            <div>
              <div style={statNumberStyle}>6 h</div>
              <div style={statLabelStyle}>weniger Korrektur pro Woche</div>
            </div>
          </div>
        </div>

        <div className="lp-hero-img" style={{ position: "relative", height: 460 }}>
          <div
            className="lp-dev-desk"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "94%",
              borderRadius: 16,
              background: "var(--surface-1)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-card-now)",
              padding: "24px 10px 12px",
            }}
          >
            <div className="lp-dev-dots" style={{ position: "absolute", top: 9, left: 14, display: "flex", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--border-strong)" }} />
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--border-strong)" }} />
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--border-strong)" }} />
            </div>
            <div style={{ width: "100%", aspectRatio: "16 / 10", borderRadius: 9, overflow: "hidden", background: "var(--surface-alt)" }}>
              <ImageSlot
                slot="hero-lms"
                placeholder="LMS-Screenshot (16:10, Desktop)"
                media={slots?.heroLms}
                sizes="(max-width: 900px) 90vw, (max-width: 1060px) 460px, 520px"
                priority
              />
            </div>
          </div>
          <div
            className="lp-dev-phone"
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              height: "78%",
              borderRadius: 30,
              background: "var(--surface-1)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-card-now)",
              padding: 9,
            }}
          >
            <div style={{ position: "relative", height: "100%", aspectRatio: "9 / 19", borderRadius: 23, overflow: "hidden", background: "var(--surface-alt)" }}>
              <ImageSlot
                slot="hero-app"
                placeholder="App-Screenshot (9:19, Hochformat)"
                media={slots?.heroApp}
                sizes="(max-width: 900px) 40vw, 180px"
              />
              <div
                style={{
                  position: "absolute",
                  top: 9,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 40,
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(0,0,0,.28)",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: "var(--surface-alt)", borderTop: "1px solid var(--border-1)", borderBottom: "1px solid var(--border-1)" }}>
        <div className="lp-sec" style={{ maxWidth: 1160, margin: "0 auto", padding: "70px 24px" }}>
          <div style={{ maxWidth: "56ch", marginBottom: 38 }}>
            <div style={eyebrowStyle}>Zwei Seiten, eine KI</div>
            <h2
              className="lp-h2"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 36,
                fontWeight: 600,
                color: "var(--text-hi)",
                margin: 0,
                letterSpacing: "-.015em",
                lineHeight: 1.15,
              }}
            >
              Lernende üben mit KI-Feedback. Lehrkräfte bewerten mit KI-Unterstützung.
            </h2>
          </div>
          <div className="lp-g3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
            <div style={cardStyle}>
              <span style={iconTile("var(--blau-tint)", "var(--blau)")}>
                <PhoneIcon />
              </span>
              <h3 style={cardTitleStyle}>Mobile App mit KI-Coach</h3>
              <p style={cardTextStyle}>
                Tägliche Übungssets im Prüfungsformat mit sofortigem KI-Feedback zu Schreiben und
                Sprechen — ein Lernstand zeigt, wie weit es bis zur Prüfung noch ist.
              </p>
            </div>
            <div style={cardStyle}>
              <span style={iconTile("var(--gruen-tint)", "var(--gruen)")}>
                <LaptopIcon />
              </span>
              <h3 style={cardTitleStyle}>LMS mit KI-Workflows</h3>
              <p style={cardTextStyle}>
                Klassen, Aufgaben und Stundenplan an einem Ort. Die KI bereitet jede Einreichung vor
                — Lehrkräfte prüfen und geben in zwei Klicks frei, statt bei null anzufangen.
              </p>
            </div>
            <div style={cardStyle}>
              <span style={iconTile("var(--lila-tint)", "var(--lila)")}>
                <SparkleIcon />
              </span>
              <h3 style={cardTitleStyle}>KI-Vorbewertung</h3>
              <p style={cardTextStyle}>
                Punkte pro Kriterium statt Prosa-Feedback: 10 / 7,5 / 5 / 2,5 / 0 wie in der Prüfung.
                Jede Note bleibt ein Vorschlag, bis eine Lehrkraft sie freigibt.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-sec" style={{ maxWidth: 1160, margin: "0 auto", padding: "76px 24px" }}>
        <div className="lp-g2" style={{ display: "grid", gridTemplateColumns: ".85fr 1.15fr", gap: 56 }}>
          <div>
            <div style={eyebrowStyle}>KI-Workflow</div>
            <h2
              className="lp-h2"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 34,
                fontWeight: 600,
                color: "var(--text-hi)",
                margin: "0 0 16px",
                letterSpacing: "-.015em",
                lineHeight: 1.15,
              }}
            >
              Vom Kurs zur KI-Bewertung in drei Schritten
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-1)", margin: "0 0 24px" }}>
              Kein Medienbruch, keine gesammelten PDFs, keine Sprachnachrichten per Messenger — die
              KI übernimmt die Vorarbeit.
            </p>
            <div className="lp-img300" style={{ borderRadius: 20, overflow: "hidden", border: "1px solid var(--border-1)", height: 280 }}>
              <ImageSlot
                slot="home-ablauf"
                placeholder="Hochformat: Lernende mit Handy (ca. 800 × 1000)"
                media={slots?.homeAblauf}
                sizes="(max-width: 900px) 90vw, 400px"
              />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={stepRow(false)}>
              <span style={stepNumberStyle}>01</span>
              <div>
                <h3 style={stepTitleStyle}>Aufgabe zuweisen</h3>
                <p style={stepTextStyle}>
                  Aus dem Prüfungs-Korpus eine Aufgabe wählen, Klasse und Frist setzen. Die Lernenden
                  sehen sie sofort in der App.
                </p>
              </div>
            </div>
            <div style={stepRow(false)}>
              <span style={stepNumberStyle}>02</span>
              <div>
                <h3 style={stepTitleStyle}>KI bewertet vor</h3>
                <p style={stepTextStyle}>
                  Text oder Aufnahme geht ein, die KI setzt in Sekunden Punkte pro Kriterium und
                  markiert Auffälligkeiten — etwa eine nicht erfüllte Aufgabenstellung.
                </p>
              </div>
            </div>
            <div style={stepRow(true)}>
              <span style={stepNumberStyle}>03</span>
              <div>
                <h3 style={stepTitleStyle}>Freigeben</h3>
                <p style={stepTextStyle}>
                  Lehrkraft prüft, korrigiert Punkte wo nötig, ergänzt einen Satz Feedback — und die
                  Bewertung erscheint im Lernstand.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaCard />
    </main>
  );
}

function iconTile(background: string, color: string): CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 12,
    background,
    color,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  };
}

function stepRow(last: boolean): CSSProperties {
  return {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "22px 0",
    borderTop: "1px solid var(--border-1)",
    ...(last ? { borderBottom: "1px solid var(--border-1)" } : {}),
  };
}
