import type { Metadata } from "next";
import { Jost, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site";

// Drei Schriftfamilien mit strikten Rollen (identisch zum Lehrkraft-Portal):
//  · Source Serif 4 → Display, Überschriften UND ALLE ZAHLEN (Punkte, Preise, Zähler)
//  · Jost (Futura-Ersatz) → UI/Body/Labels/Buttons
//  · IBM Plex Mono → getippter Prüfungstext (eingereichte Aufsätze)
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

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Satzwerk · Deutsch für die Prüfung üben",
  description:
    "Übe Redemittel für die Goethe-Prüfung (Schreiben & Sprechen) — baue deutsche Sätze aus einer Wortbank. Satzwerk von Digital Sprache Institut.",
};

export const viewport = {
  // Einzelner Wert (kein media), damit genau ein <meta name="theme-color">
  // entsteht, dessen Inhalt wir je nach gewähltem Theme per JS aktualisieren.
  themeColor: "#fdfbf6",
  width: "device-width",
  initialScale: 1,
  // Inhalt bis unter die Notch ziehen, damit der (fixe) Seitenhintergrund
  // nahtlos in den Safe-Area-Bereich oben übergeht (kein harter Farbbalken).
  viewportFit: "cover" as const,
};

// Setzt das Theme vor dem ersten Paint (kein Flash): gespeicherte Wahl,
// sonst Systemeinstellung. Fällt im Fehlerfall auf Papier (hell) zurück.
// Färbt zugleich die theme-color (iPhone-Notch/Statusleiste) passend zum Papier.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',t==='dark'?'#15120e':'#fdfbf6');}catch(e){document.documentElement.dataset.theme='light';}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      data-theme="light"
      suppressHydrationWarning
      className={`h-full antialiased ${jost.variable} ${sourceSerif.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/* Die Fußzeile lebt in der Content-Spalte von PublicShell — auf dem
          Desktop scrollt sie mit ihr. /uebung (bildschirmfüllender Player)
          bekommt dadurch bewusst keine Fußzeile mehr. */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
