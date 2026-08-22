import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Allgemeine Geschäftsbedingungen",
  description:
    "Bedingungen für die Bereitstellung von Lernen (App) und LMS durch das Digital Sprache Institut: Leistungsumfang, Konten, Bewertungen, Preise, Laufzeit und Haftung.",
  alternates: { canonical: "/agb" },
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Allgemeine Geschäftsbedingungen"
      status="Stand: 21. August 2026 · Entwurf zur juristischen Prüfung"
    >
      <h2 className="h-sec">1. Geltungsbereich</h2>
      <p>
        Diese Bedingungen gelten für die Bereitstellung von Lernen (App) und LMS durch das Digital
        Sprache Institut an Unternehmen, Bildungseinrichtungen und freiberufliche Lehrkräfte.
        Abweichende Bedingungen des Kunden gelten nur bei schriftlicher Bestätigung.
      </p>

      <h2 className="h-sec">2. Leistungsumfang</h2>
      <p>
        Der Umfang ergibt sich aus dem gebuchten Tarif. Wir stellen die Software als
        Software-as-Service bereit, entwickeln sie fortlaufend weiter und dürfen Funktionen ändern,
        solange der vertraglich zugesagte Kern erhalten bleibt. Angestrebte Verfügbarkeit: 99,5 % im
        Monatsmittel, ausgenommen angekündigte Wartungsfenster.
      </p>

      <h2 className="h-sec">3. Konten und Nutzung</h2>
      <p>
        Der Kunde verwaltet die Konten seiner Lehrkräfte und Teilnehmenden und hält Zugangsdaten
        geheim. Untersagt sind Weitergabe von Zugängen an Dritte, automatisiertes Auslesen von
        Inhalten sowie das Hochladen rechtswidriger Inhalte.
      </p>

      <h2 className="h-sec">4. Bewertungen</h2>
      <p>
        Automatisch erzeugte Bewertungsvorschläge sind Hilfsmittel. Verantwortlich für die Bewertung
        bleibt die Lehrkraft beziehungsweise die Einrichtung; eine Gewähr für die Übereinstimmung
        mit Ergebnissen amtlicher Prüfungen wird nicht übernommen.
      </p>

      <h2 className="h-sec">5. Preise und Zahlung</h2>
      <p>
        Preise gelten zzgl. gesetzlicher Umsatzsteuer. Die Abrechnung erfolgt im Voraus für die
        gebuchte Periode. Bei Überschreitung von Tarifgrenzen wird auf den nächsten Tarif
        umgestellt, nachdem wir den Kunden informiert haben.
      </p>

      <h2 className="h-sec">6. Laufzeit und Kündigung</h2>
      <p>
        Monatstarife laufen einen Monat und verlängern sich automatisch; Kündigung ist bis zum Ende
        der laufenden Periode möglich. Jahrestarife laufen zwölf Monate mit Kündigungsfrist von 30
        Tagen zum Laufzeitende. Testzugänge enden ohne Kündigung.
      </p>

      <h2 className="h-sec">7. Rechte an Inhalten</h2>
      <p>
        Vom Kunden und seinen Teilnehmenden erstellte Inhalte bleiben deren Eigentum. Wir erhalten
        nur das Recht, sie zur Erbringung der Leistung zu verarbeiten. Aufgaben-Korpora und Software
        bleiben Eigentum des Digi-S Institute.
      </p>

      <h2 className="h-sec">8. Haftung</h2>
      <p>
        Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie nach dem
        Produkthaftungsgesetz. Bei einfacher Fahrlässigkeit haften wir nur für die Verletzung
        wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, vertragstypischen
        Schaden, höchstens auf das in zwölf Monaten gezahlte Entgelt.
      </p>

      <h2 className="h-sec">9. Schlussbestimmungen</h2>
      <p>
        Es gilt deutsches Recht. Gerichtsstand ist [Ort], soweit gesetzlich zulässig. Änderungen
        dieser Bedingungen teilen wir mindestens sechs Wochen vorher mit; widerspricht der Kunde
        nicht, gelten sie als angenommen.
      </p>
    </LegalShell>
  );
}
