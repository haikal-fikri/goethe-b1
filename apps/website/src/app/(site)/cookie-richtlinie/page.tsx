import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Cookie-Richtlinie",
  description:
    "Welche Cookies das Digital Sprache Institut setzt, welche einwilligungspflichtig sind und wie Sie Ihre Auswahl ändern.",
  alternates: { canonical: "/cookie-richtlinie" },
};

export default function CookiePolicyPage() {
  return (
    <LegalShell title="Cookie-Richtlinie" status="Stand: 21. August 2026 · Entwurf zur juristischen Prüfung">
      <h2 className="h-sec">1. Was wir setzen</h2>
      <p>
        Wir verwenden so wenige Cookies wie möglich. Auf dieser Website sind ausschließlich
        technisch notwendige Cookies aktiv, bis Sie in weitere einwilligen (§ 25 Abs. 2 TDDDG).
      </p>

      <h2 className="h-sec">2. Übersicht</h2>
      <ul>
        <li>
          <strong>session</strong> — hält die Anmeldung. Notwendig, Laufzeit bis Ende der Sitzung.
        </li>
        <li>
          <strong>csrf</strong> — schützt Formulare vor Missbrauch. Notwendig, Sitzung.
        </li>
        <li>
          <strong>prefs</strong> — speichert Sprache und Hell-/Dunkel-Modus. Notwendig, 12 Monate.
        </li>
        <li>
          <strong>stats</strong> — anonyme Reichweitenmessung ohne Profilbildung. Nur mit
          Einwilligung, 6 Monate.
        </li>
      </ul>

      <h2 className="h-sec">3. Einwilligung verwalten</h2>
      <p>
        Ihre Auswahl können Sie jederzeit über den Link „Cookie-Einstellungen“ im Seitenfuß ändern
        oder widerrufen. Ohne Einwilligung bleiben alle Funktionen der Website und des LMS nutzbar.
      </p>

      <h2 className="h-sec">4. Cookies im LMS und in der App</h2>
      <p>
        Innerhalb des angemeldeten Bereichs setzen wir nur Cookies, die für Anmeldung, Sicherheit
        und gespeicherte Einstellungen erforderlich sind. Tracking durch Dritte findet dort nicht
        statt.
      </p>

      <h2 className="h-sec">5. Browser-Einstellungen</h2>
      <p>
        Cookies lassen sich auch im Browser blockieren oder löschen. Notwendige Cookies zu
        blockieren kann Anmeldung und Formulare unbrauchbar machen.
      </p>
    </LegalShell>
  );
}
