import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redemittel-Trainer · Goethe B1",
  description:
    "Übe Redemittel für die Goethe-B1-Prüfung (Schreiben & Sprechen) — baue deutsche Sätze aus einer Wortbank.",
};

export const viewport = {
  themeColor: "#0d1117",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
