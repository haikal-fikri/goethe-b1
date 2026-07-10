import { redirect } from "next/navigation";
import { requireAuth, isTeacher, isAdmin } from "@/lib/auth";
import { UpgradeButton } from "@/components/abo/UpgradeButton";
import { IconCheck } from "@/components/icons";

export const dynamic = "force-dynamic";

// Onboarding-Schleuse für angemeldete Konten OHNE Lehrkraft-Rolle. Die Rolle
// 'teacher' wird erst durch ein aktives Abo (Polar-Webhook) oder eine
// Organisations-Einladung (Seat) vergeben — ein frisch registriertes Konto ist
// 'student'. Der (app)-Layout leitet solche Konten hierher. Bereits berechtigte
// Lehrkräfte werden sofort ins Portal weitergereicht (keine Sackgasse).
const PLANS = [
  {
    plan: "starter" as const,
    name: "Starter",
    price: "99 €",
    period: "/ Monat",
    features: ["Bis zu 3 Klassen", "Bis zu 60 Teilnehmende", "KI-Bewertung Schreiben & Sprechen"],
    variant: "primary" as const,
  },
  {
    plan: "pro" as const,
    name: "Pro",
    price: "249 €",
    period: "/ Monat",
    features: ["Unbegrenzt Klassen & Teilnehmende", "Bis zu 20 Lehrkräfte-Sitze", "Faire Nutzung statt harter Limits"],
    variant: "accent" as const,
  },
];

export default async function WillkommenPage() {
  const user = await requireAuth("/willkommen");
  // Berechtigte Konten gehören ins Portal, nicht auf diese Seite.
  if (isTeacher(user) || isAdmin(user)) redirect("/dashboard");

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div style={{ width: 720, maxWidth: "100%" }}>
        {/* Marke */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              background: "var(--gruen)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--glow-gruen)",
            }}
          >
            <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 20, color: "#fff" }}>B1</span>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-hi)" }}>B1+Trainer</div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--text-2)",
              }}
            >
              Lehrkraft
            </div>
          </div>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 30,
            fontWeight: 600,
            color: "var(--text-hi)",
            margin: "0 0 8px",
            letterSpacing: "-.01em",
          }}
        >
          Lehrkraft-Zugang freischalten
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 14.5, lineHeight: 1.55, color: "var(--text-2)", maxWidth: 560 }}>
          Ihr Konto <strong style={{ color: "var(--text-hi)" }}>{user.email}</strong> ist angemeldet, aber noch nicht
          als Lehrkraft freigeschaltet. Wählen Sie einen Tarif, um Klassen anzulegen und Abgaben zu bewerten — oder
          nehmen Sie eine Einladung Ihrer Einrichtung an, falls Sie einen Sitz erhalten haben.
        </p>

        {/* Tarife */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {PLANS.map((p) => (
            <div
              key={p.plan}
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border-1)",
                borderRadius: 20,
                boxShadow: "var(--shadow-card-now)",
                padding: "22px 22px 24px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--text-2)",
                  marginBottom: 10,
                }}
              >
                {p.name}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 18 }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 34, fontWeight: 600, color: "var(--text-hi)", lineHeight: 1 }}>
                  {p.price}
                </span>
                <span style={{ fontSize: 13, color: "var(--text-2)" }}>{p.period}</span>
              </div>
              <ul style={{ listStyle: "none", margin: "0 0 22px", padding: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.45 }}>
                    <IconCheck size={16} style={{ color: "var(--gruen)", flex: "0 0 16px", marginTop: 2 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <UpgradeButton plan={p.plan} label={`${p.name} wählen`} variant={p.variant} style={{ width: "100%" }} />
            </div>
          ))}
        </div>

        {/* Abmelden */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            Falsches Konto? Melden Sie sich ab und wechseln Sie die E-Mail.
          </span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="hover-surface press"
              style={{
                height: 40,
                padding: "0 16px",
                borderRadius: 11,
                border: "1px solid var(--border-1)",
                background: "transparent",
                color: "var(--text-1)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Abmelden
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
