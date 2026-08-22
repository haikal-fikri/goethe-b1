import type { Metadata, Viewport } from "next";
import { Jost, Source_Serif_4 } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { jsonLdScript, organizationJsonLd } from "@/lib/jsonld";
import { getSiteSettings } from "@/lib/queries";
import { SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

/**
 * Zwei Familien mit festen Rollen (Design-System):
 *  · Source Serif 4 → Display, Überschriften UND alle Zahlen
 *  · Jost → UI, Fließtext, Labels, Buttons (Ersatz für Futura)
 *
 * next/font lädt beide zur Build-Zeit herunter und liefert sie von der eigenen
 * Domain aus — die Website macht zur Laufzeit keine Drittanbieter-Requests.
 */
const jost = Jost({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jost",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Digital Sprache Institut · KI-gestütztes Deutschlernen für Prüfungserfolg",
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Lernende trainieren mit KI-Feedback in Echtzeit für Schreiben, Sprechen, Lesen und Hören im echten Prüfungsformat. Lehrkräfte bereiten ihre Kurse mit KI-gestützten Workflows vor — von der Aufgabe bis zur Korrektur.",
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: SITE_NAME,
    url: siteUrl,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Ein einzelner Wert: Eine media-abhängige themeColor lässt Next den Header
  // `Critical-CH: Sec-CH-Prefers-Color-Scheme` senden, was bei jedem
  // Erstbesuch einen zusätzlichen Anlauf der Anfrage auslöst.
  themeColor: "#FDFBF6",
};

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();

  return (
    <html lang="de" className={`${jost.variable} ${sourceSerif.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd(settings)) }}
        />
        <a href="#inhalt" className="sr-only">
          Zum Inhalt springen
        </a>
        <div
          style={{
            minHeight: "100vh",
            background: "var(--bg)",
            color: "var(--text-1)",
            fontFamily: "var(--font-ui)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Header
            lernenUrl={settings.lernenUrl}
            appStoreUrl={settings.appStoreUrl}
            playStoreUrl={settings.playStoreUrl}
          />
          <div id="inhalt" tabIndex={-1} style={{ flex: 1, outline: "none" }}>
            {children}
          </div>
          <Footer lernenUrl={settings.lernenUrl} contactEmail={settings.contactEmail} />
        </div>
      </body>
    </html>
  );
}
