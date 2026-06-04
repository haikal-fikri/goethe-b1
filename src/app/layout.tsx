import type { Metadata } from "next";
import { Jost, Fraunces } from "next/font/google";
import "./globals.css";

// Jost = quelloffene Futura-Alternative (Fallback-Webfont, falls echtes Futura
// nicht installiert ist). Fraunces = Serifen-Paar für die Überschriften.
const jost = Jost({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jost",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "B1-Trainer · Goethe B1",
  description:
    "Übe Redemittel für die Goethe-B1-Prüfung (Schreiben & Sprechen) — baue deutsche Sätze aus einer Wortbank.",
};

export const viewport = {
  // Einzelner Wert (kein media), damit genau ein <meta name="theme-color">
  // entsteht, dessen Inhalt wir je nach gewähltem Theme per JS aktualisieren.
  themeColor: "#17191b",
  width: "device-width",
  initialScale: 1,
  // Inhalt bis unter die Notch ziehen, damit der (fixe) Seitenhintergrund
  // nahtlos in den Safe-Area-Bereich oben übergeht (kein harter Farbbalken).
  viewportFit: "cover" as const,
};

// Setzt das Theme vor dem ersten Paint (kein Flash): gespeicherte Wahl,
// sonst Systemeinstellung. Fällt im Fehlerfall auf die Tafel (dark) zurück.
// Färbt zugleich die theme-color (iPhone-Notch/Statusleiste) passend zum Header.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',t==='light'?'#faf7f1':'#17191b');}catch(e){document.documentElement.dataset.theme='dark';}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`h-full antialiased ${jost.variable} ${fraunces.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
