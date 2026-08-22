/** Das getönte Zitat-Kästchen im Artikel (Design, Artikelseite). */
export function PullQuote({ quote, attribution }: { quote: string; attribution?: string }) {
  return (
    <figure
      style={{
        background: "var(--surface-alt)",
        border: "1px solid var(--border-1)",
        borderRadius: 18,
        padding: "24px 26px",
        margin: "30px 0",
      }}
    >
      <blockquote style={{ margin: 0 }}>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.7, color: "var(--text-1)" }}>{quote}</p>
      </blockquote>
      {attribution ? (
        <figcaption style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 10 }}>
          {attribution}
        </figcaption>
      ) : null}
    </figure>
  );
}
