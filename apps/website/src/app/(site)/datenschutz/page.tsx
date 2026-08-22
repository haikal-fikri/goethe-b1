import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { getSiteSettings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description:
    "Wie das Digital Sprache Institut personenbezogene Daten verarbeitet: Zwecke, Rechtsgrundlagen, KI-Vorbewertung, Auftragsverarbeiter, Speicherdauer und Ihre Rechte.",
  alternates: { canonical: "/datenschutz" },
};

export default async function PrivacyPage() {
  const settings = await getSiteSettings();
  const privacyEmail = settings.privacyEmail ?? "datenschutz@digi-s.institute";

  return (
    <LegalShell title="Datenschutzerklärung" status="Stand: 21. August 2026 · Entwurf zur juristischen Prüfung">
      <h2 className="h-sec">1. Verantwortlicher</h2>
      <p>
        Digital Sprache Institut, [Straße], [PLZ Ort], Deutschland. Anfragen zum Datenschutz:{" "}
        <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>. Eine Datenschutzbeauftragte ist
        [benannt / nicht benannt].
      </p>

      <h2 className="h-sec">2. Welche Daten wir verarbeiten</h2>
      <ul>
        <li>
          <strong>Kontodaten:</strong> Name, E-Mail-Adresse, Rolle, zugeordnete Klasse und
          Einrichtung.
        </li>
        <li>
          <strong>Lern- und Prüfungsdaten:</strong> eingereichte Texte, Sprachaufnahmen, Antworten,
          Punkte, Feedback und Zeitstempel.
        </li>
        <li>
          <strong>Nutzungsdaten:</strong> Anmeldezeitpunkte, Gerätetyp, technische Protokolle zur
          Fehlerbehebung.
        </li>
        <li>
          <strong>Anfragedaten:</strong> Angaben aus dem Kontaktformular.
        </li>
      </ul>

      <h2 className="h-sec">3. Zwecke und Rechtsgrundlagen</h2>
      <p>
        Bereitstellung von App und LMS sowie Bewertung von Einreichungen erfolgen zur Erfüllung des
        Vertrags mit der Einrichtung (Art. 6 Abs. 1 lit. b DSGVO); für Teilnehmende handeln wir als
        Auftragsverarbeiter der Einrichtung (Art. 28 DSGVO). Betriebssicherheit, Fehlerbehebung und
        Missbrauchsabwehr stützen wir auf berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO).
        Optionale Funktionen und Marketing-Mails nur mit Einwilligung (Art. 6 Abs. 1 lit. a DSGVO),
        jederzeit widerruflich.
      </p>

      <h2 className="h-sec">4. KI-gestützte Vorbewertung</h2>
      <p>
        Eingereichte Texte und Aufnahmen werden zur Erstellung eines Bewertungsvorschlags
        automatisiert verarbeitet. Der Vorschlag hat keine Rechtswirkung: er wird erst nach Prüfung
        und Freigabe durch eine Lehrkraft wirksam, es findet also keine ausschließlich
        automatisierte Entscheidung im Sinne des Art. 22 DSGVO statt. Kursdaten werden nicht zum
        Training von Modellen verwendet.
      </p>

      <h2 className="h-sec">5. Auftragsverarbeiter und Hosting</h2>
      <p>
        Sprachverarbeitung und Hosting erfolgen teils über Auftragsverarbeiter außerhalb der EU/des
        EWR. In diesen Fällen stellen wir ein angemessenes Schutzniveau sicher, insbesondere durch
        EU-Standardvertragsklauseln (Art. 46 DSGVO) und zusätzliche technische Maßnahmen. Wir setzen
        Auftragsverarbeiter nur mit Vertrag nach Art. 28 DSGVO ein; eine aktuelle Liste inklusive
        Verarbeitungsort erhalten Einrichtungen auf Anfrage.
      </p>

      <h2 className="h-sec">6. Speicherdauer</h2>
      <p>
        Lern- und Prüfungsdaten löschen wir spätestens 24 Monate nach Ende des Kurses oder früher
        auf Weisung der Einrichtung. Kontodaten werden mit dem Konto gelöscht, Protokolldaten nach
        90 Tagen, Anfragen aus dem Kontaktformular nach 12 Monaten. Gesetzliche
        Aufbewahrungspflichten bleiben unberührt.
      </p>

      <h2 className="h-sec">7. Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit und Widerspruch sowie das Recht, eine Einwilligung zu widerrufen. Bitte
        richten Sie Anfragen zu Kursdaten zunächst an Ihre Einrichtung. Zudem können Sie sich bei
        einer Datenschutz-Aufsichtsbehörde beschweren.
      </p>

      <h2 className="h-sec">8. Sicherheit</h2>
      <p>
        Übertragung ausschließlich verschlüsselt (TLS), Speicherung verschlüsselt, Zugriff
        rollenbasiert und protokolliert. Technische und organisatorische Maßnahmen dokumentieren wir
        und stellen sie Einrichtungen als Anlage zum AV-Vertrag bereit.
      </p>
    </LegalShell>
  );
}
