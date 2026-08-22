import Link from "next/link";

/** Die Abschlusskarte der Startseite: „Sehen Sie die KI an Ihren eigenen Kursdaten." */
export function CtaCard() {
  return (
    <section className="lp-sec-b" style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px 84px" }}>
      <div
        className="lp-ctacard"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-1)",
          borderRadius: 24,
          boxShadow: "var(--shadow-card-now)",
          padding: "44px 48px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 40,
          alignItems: "center",
        }}
      >
        <div>
          <h2
            className="lp-h2s"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 30,
              fontWeight: 600,
              color: "var(--text-hi)",
              margin: "0 0 10px",
              letterSpacing: "-.015em",
            }}
          >
            Sehen Sie die KI an Ihren eigenen Kursdaten.
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--text-1)", margin: 0, maxWidth: "58ch" }}>
            30 Minuten Demo, danach ein Testzugang mit einer echten Klasse. Kein Vertrag, keine
            Einrichtungsgebühr.
          </p>
        </div>
        <div className="lp-btnrow" style={{ display: "flex", gap: 12 }}>
          <Link
            href="/kontakt"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 48,
              padding: "0 22px",
              borderRadius: 15,
              background: "var(--gruen)",
              color: "#fff",
              fontSize: 14.5,
              fontWeight: 600,
              boxShadow: "var(--glow-gruen)",
            }}
          >
            Demo buchen
          </Link>
          <Link
            href="/loesungen"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 48,
              padding: "0 22px",
              borderRadius: 15,
              border: "1px solid var(--border-strong)",
              background: "var(--bg)",
              color: "var(--text-hi)",
              fontSize: 14.5,
              fontWeight: 600,
            }}
          >
            Preise
          </Link>
        </div>
      </div>
    </section>
  );
}
