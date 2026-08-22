import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { FaqAccordion, type FaqItem } from "@/components/FaqAccordion";
import { ImageSlot } from "@/components/ImageSlot";
import { StoreBadges } from "@/components/StoreBadges";
import { DocumentIcon, LaptopIcon, LockIcon, MicIcon, PenIcon, PhoneIcon, CheckIcon } from "@/components/icons";
import { PricingSection } from "@/components/pricing/PricingSection";
import { getPricing, getSiteSettings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Lösungen",
  description:
    "Die mobile App trainiert Lernende mit KI-Feedback, das LMS gibt Lehrkräften KI-gestützte Workflows für die Korrektur — beide teilen dasselbe Aufgaben-Korpus und dieselben Bewertungskriterien.",
  alternates: { canonical: "/loesungen" },
};

const FAQS: FaqItem[] = [
  { q: "Ersetzt die KI die Lehrkraft?", a: "Nein. Ohne Freigabe durch eine Lehrkraft wird keine Bewertung sichtbar." },
  {
    q: "Wo liegen die Daten?",
    a: "Bei geprüften Auftragsverarbeitern mit DSGVO-konformen Garantien. Kursdaten werden nicht zum Modelltraining verwendet.",
  },
  {
    q: "Brauchen Teilnehmende ein eigenes Konto?",
    a: "Sie werden über einen Klassencode eingeladen — E-Mail-Adresse optional.",
  },
  {
    q: "Welche Niveaus sind verfügbar?",
    a: "B1 ist heute vollständig abgedeckt. A1 bis C1 folgen schrittweise; Campus-Kunden können eigene Korpora einbringen.",
  },
];

const APP_FEATURES = [
  {
    title: "Alle vier Prüfungsteile",
    text: "Lesen, Hören, Schreiben, Sprechen — inklusive Teil 3 mit Rückfragen.",
  },
  {
    title: "Sofortiges KI-Feedback",
    text: "Aufnehmen, anhören, KI-Einschätzung erhalten, erneut versuchen — dann zur finalen Bewertung an die Lehrkraft.",
  },
  {
    title: "Prüfungsreife statt Punktejagd",
    text: "Der Lernstand zeigt pro Prüfungsteil, was für ein Bestehen noch fehlt.",
  },
  {
    title: "Offline vorbereiten",
    text: "Übungssets werden geladen und lassen sich ohne Netz bearbeiten.",
  },
];

const LMS_FEATURES = [
  {
    title: "KI-Bewertungs-Queue",
    text: "Alle offenen Einreichungen bereits KI-vorbewertet, nach Klasse, Aufgabe und Wartezeit sortiert.",
  },
  {
    title: "Bewertungsraster der Prüfung",
    text: "Punkte pro Kriterium anklickbar, Gesamtwert rechnet live nach — inklusive Null-Regel bei nicht erfüllter Aufgabe.",
  },
  {
    title: "Klassen, Aufgaben, Stundenplan",
    text: "Kursverwaltung, Fristen und Anwesenheiten ohne zweites Tool.",
  },
  {
    title: "Auswertungen pro Klasse",
    text: "Punkte je Kriterium und Prüfungsteil über die Zeit, als Zwischenbericht oder CSV-Export.",
  },
];

const productCardStyle: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-1)",
  borderRadius: 22,
  boxShadow: "var(--shadow-card-now)",
  padding: "32px 34px",
};

const featureTitleStyle: CSSProperties = {
  fontSize: 14.5,
  fontWeight: 600,
  color: "var(--text-hi)",
  marginBottom: 3,
};

const featureTextStyle: CSSProperties = { fontSize: 13.5, lineHeight: 1.6, color: "var(--text-1)" };

const criteriaCardStyle: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-1)",
  borderRadius: 16,
  padding: 18,
};

const criteriaLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--text-2)",
  marginBottom: 8,
};

const criteriaTextStyle: CSSProperties = { fontSize: 13.5, lineHeight: 1.6, color: "var(--text-1)" };

function FeatureList({ items }: { items: { title: string; text: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((item) => (
        <div key={item.title} style={{ display: "flex", gap: 12 }}>
          <span style={{ color: "var(--gruen)", flex: "0 0 18px", marginTop: 2 }}>
            <CheckIcon />
          </span>
          <div>
            <div style={featureTitleStyle}>{item.title}</div>
            <div style={featureTextStyle}>{item.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function SolutionsPage() {
  const [settings, pricing] = await Promise.all([getSiteSettings(), getPricing()]);
  const slots = settings.imageSlots;

  return (
    <main>
      <section className="lp-sec" style={{ maxWidth: 1160, margin: "0 auto", padding: "76px 24px 56px" }}>
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
          Lösungen
        </div>
        <h1
          className="lp-h1s"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 52,
            fontWeight: 600,
            color: "var(--text-hi)",
            margin: "0 0 20px",
            letterSpacing: "-.025em",
            lineHeight: 1.08,
            maxWidth: "22ch",
            textWrap: "balance",
          }}
        >
          KI-gestütztes Deutschlernen für Prüfungserfolg.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--text-1)", margin: 0, maxWidth: "60ch" }}>
          Die mobile App trainiert Lernende mit KI-Feedback, das LMS gibt Lehrkräften KI-gestützte
          Workflows für die Korrektur — beide teilen dasselbe Aufgaben-Korpus und dieselben
          Bewertungskriterien.
        </p>
      </section>

      <section className="lp-sec-b" style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px 30px" }}>
        <div className="lp-g2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div className="lp-card" style={productCardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: "var(--blau-tint)",
                  color: "var(--blau)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 38px",
                }}
              >
                <PhoneIcon size={19} />
              </span>
              <div>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: ".11em",
                    textTransform: "uppercase",
                    color: "var(--text-2)",
                  }}
                >
                  Für Lernende
                </div>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600, color: "var(--text-hi)", margin: "2px 0 0" }}>
                  Mobile App
                </h2>
              </div>
            </div>
            <div
              className="lp-img300"
              style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-1)", height: 300, marginBottom: 22 }}
            >
              <ImageSlot
                slot="sol-app"
                placeholder="App-Screenshot im Telefon-Gerät (ca. 1200 × 900)"
                media={slots?.solApp}
                sizes="(max-width: 900px) 90vw, 540px"
              />
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--text-1)", margin: "0 0 22px" }}>
              KI-gestützte Übungen im Format der Goethe-Zertifikate — mit sofortigem Feedback statt
              Karteikarten-Deutsch.
            </p>
            <FeatureList items={APP_FEATURES} />
            <StoreBadges
              appStoreUrl={settings.appStoreUrl}
              playStoreUrl={settings.playStoreUrl}
              variant="card"
            />
          </div>

          <div className="lp-card" style={productCardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: "var(--gruen-tint)",
                  color: "var(--gruen)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 38px",
                }}
              >
                <LaptopIcon size={19} />
              </span>
              <div>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: ".11em",
                    textTransform: "uppercase",
                    color: "var(--text-2)",
                  }}
                >
                  Für Lehrkräfte &amp; Schulen
                </div>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600, color: "var(--text-hi)", margin: "2px 0 0" }}>
                  Das LMS
                </h2>
              </div>
            </div>
            <div
              className="lp-img300"
              style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-1)", height: 300, marginBottom: 22 }}
            >
              <ImageSlot
                slot="sol-lms"
                placeholder="LMS-Screenshot im Laptop-Gerät (ca. 1200 × 900)"
                media={slots?.solLms}
                sizes="(max-width: 900px) 90vw, 540px"
              />
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--text-1)", margin: "0 0 22px" }}>
              Korrigieren ist der Engpass jeder Prüfungsvorbereitung. KI-gestützte Workflows nehmen
              Lehrkräften die Vorarbeit ab — die Entscheidung bleibt bei ihnen.
            </p>
            <FeatureList items={LMS_FEATURES} />
          </div>
        </div>
      </section>

      <section className="lp-padx" style={{ maxWidth: 1160, margin: "0 auto", padding: "46px 24px 0" }}>
        <div
          className="lp-card lp-g2"
          style={{
            background: "var(--surface-alt)",
            border: "1px solid var(--border-1)",
            borderRadius: 22,
            padding: "34px 38px",
            display: "grid",
            gridTemplateColumns: ".9fr 1.1fr",
            gap: 44,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".13em",
                textTransform: "uppercase",
                color: "var(--text-2)",
                marginBottom: 11,
              }}
            >
              KI-Bewertung
            </div>
            <h2
              className="lp-h2s"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 28,
                fontWeight: 600,
                color: "var(--text-hi)",
                margin: "0 0 12px",
                letterSpacing: "-.015em",
                lineHeight: 1.2,
              }}
            >
              Die KI schlägt vor. Die Lehrkraft entscheidet.
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--text-1)", margin: 0 }}>
              Jede Bewertung ist bis zur Freigabe ein Entwurf. Überschreibungen werden protokolliert
              und fließen in die Qualitätssicherung ein — so sehen Sie, wo das Modell abweicht, statt
              ihm blind zu vertrauen.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={criteriaCardStyle}>
              <div style={criteriaLabelStyle}>
                <PenIcon />
                Schreiben
              </div>
              <div style={criteriaTextStyle}>4 Kriterien × 10 Punkte, Stufen 10 / 7,5 / 5 / 2,5 / 0</div>
            </div>
            <div style={criteriaCardStyle}>
              <div style={criteriaLabelStyle}>
                <MicIcon />
                Sprechen
              </div>
              <div style={criteriaTextStyle}>
                Aufgabenerfüllung, Interaktion, Aussprache — Stufen bis 16 Punkte
              </div>
            </div>
            <div style={criteriaCardStyle}>
              <div style={criteriaLabelStyle}>
                <DocumentIcon />
                Protokoll
              </div>
              <div style={criteriaTextStyle}>Jede Abweichung mit Zeitstempel, Lehrkraft und Begründung</div>
            </div>
            <div style={criteriaCardStyle}>
              <div style={criteriaLabelStyle}>
                <LockIcon />
                Datenlage
              </div>
              <div style={criteriaTextStyle}>Verschlüsselte Verarbeitung, kein Training auf Kursdaten</div>
            </div>
          </div>
        </div>
      </section>

      <PricingSection tiers={pricing.tiers ?? []} note={pricing.note} />

      <section className="lp-sec" style={{ maxWidth: 1160, margin: "0 auto", padding: "60px 24px 84px" }}>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 26,
            fontWeight: 600,
            color: "var(--text-hi)",
            margin: "0 0 22px",
            letterSpacing: "-.015em",
          }}
        >
          Häufige Fragen
        </h2>
        <FaqAccordion items={FAQS} />
      </section>
    </main>
  );
}
