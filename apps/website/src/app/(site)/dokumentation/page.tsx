import type { Metadata } from "next";
import Link from "next/link";
import { DocsSearch } from "@/components/docs/DocsSearch";
import { getDocsNav, getDocsSearchIndex, popularDocs } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Dokumentation",
  description:
    "Alles zum Einrichten von Klassen, zum Zuweisen von Aufgaben und zur KI-gestützten Bewertung — geschrieben für Lehrkräfte und Administratorinnen.",
  alternates: { canonical: "/dokumentation" },
};

export default async function DocsIndexPage() {
  const [groups, searchIndex] = await Promise.all([getDocsNav(), getDocsSearchIndex()]);
  // Eine Kapitelkarte erscheint, sobald das Kapitel eine Beschreibung hat —
  // die Beschreibung IST der Inhalt der Karte. So zeigt die Seite exakt die
  // vier Karten des Designs (das Kapitel „Verwaltung" hat dort keine
  // Beschreibung und keine Karte, ist aber in der Seitenleiste erreichbar).
  // Eine fünfte Karte ist damit eine reine Inhaltsänderung im Admin.
  // Die Artikelzahl wird abgeleitet, nicht gepflegt.
  const cards = groups.filter((group) => group.items.length > 0 && group.description);
  const popular = popularDocs(groups);

  return (
    <>
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
        Dokumentation
      </div>
      <h1
        className="lp-h1s"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 40,
          fontWeight: 600,
          color: "var(--text-hi)",
          margin: "0 0 14px",
          letterSpacing: "-.022em",
          lineHeight: 1.12,
        }}
      >
        Willkommen in der Dokumentation
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--text-1)", margin: "0 0 26px", maxWidth: "62ch" }}>
        Alles zum Einrichten von Klassen, zum Zuweisen von Aufgaben und zur KI-gestützten Bewertung —
        geschrieben für Lehrkräfte und Administratorinnen, nicht für Entwicklerteams.
      </p>

      <DocsSearch entries={searchIndex} />

      {cards.length > 0 ? (
        <div className="lp-g2f" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 40 }}>
          {cards.map((group) => (
            <Link
              key={group.id}
              href={group.items[0].href}
              className="hover-border"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border-1)",
                borderRadius: 18,
                padding: "22px 24px",
                color: "var(--text-hi)",
              }}
            >
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600, color: "var(--text-hi)", marginBottom: 7 }}>
                {group.label}
              </div>
              {group.description ? (
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-1)", margin: "0 0 12px" }}>
                  {group.description}
                </p>
              ) : null}
              <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                {group.items.length} {group.items.length === 1 ? "Artikel" : "Artikel"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 14.5, color: "var(--text-2)" }}>
          Die Dokumentation wird gerade aufgebaut.
        </p>
      )}

      {popular.length > 0 ? (
        <>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 16px" }}>
            Häufig gelesen
          </h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {popular.map((doc) => (
              <Link
                key={doc.id}
                href={doc.href}
                className="hover-gruen"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "15px 2px",
                  borderTop: "1px solid var(--border-1)",
                  fontSize: 14.5,
                  color: "var(--text-hi)",
                }}
              >
                {doc.title}
                <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{doc.groupLabel} ›</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
