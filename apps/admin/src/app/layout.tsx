import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Source_Serif_4, Jost, IBM_Plex_Mono } from "next/font/google";

// Identisch zum Lehrkraft-Portal (ein Designsystem, drei Rollen):
//  · Source Serif 4 → Display, Überschriften UND ALLE Zahlen
//  · Jost → UI/Body/Labels/Buttons
//  · IBM Plex Mono → getippter Prüfungstext (Korpus-Editor)
const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});
const ui = Jost({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "B1+ Superadmin",
  description: "Superadmin-Konsole (Oversight + Corpus-Editor)",
  robots: { index: false, follow: false },
};

// Flash-freie Theme-Anwendung: setzt data-theme VOR dem ersten Paint aus
// localStorage ('b1lk-theme' = 'light' | 'dark'), sonst System-Präferenz.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('b1lk-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="de"
      data-theme="light"
      className={`${serif.variable} ${ui.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
