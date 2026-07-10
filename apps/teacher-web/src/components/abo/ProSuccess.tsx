import Link from "next/link";
import { IconCheck } from "@/components/icons";

// Erfolgs-Overlay nach dem Checkout-Return (?upgraded=1). Vollflächig, wie im
// Design (1769–1776). Rein präsentativ (kein State) — die einzige Aktion führt
// aus dem Overlay heraus zum Dashboard.
export function ProSuccess() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: 420, maxWidth: "100%", textAlign: "center" }}>
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: 999,
            background: "var(--gruen)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 22px",
            boxShadow: "var(--glow-gruen)",
          }}
        >
          <IconCheck size={38} strokeWidth={2.4} />
        </div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 10px" }}>
          Willkommen bei Pro!
        </h1>
        <p style={{ margin: "0 0 26px", fontSize: 14.5, lineHeight: 1.6, color: "var(--text-2)" }}>
          Ihr Tarif wurde aktiviert. Sie können jetzt unbegrenzt viele Klassen anlegen und profitieren von fairer
          Nutzung statt harter Limits.
        </p>
        <Link
          href="/dashboard"
          className="press"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: 52,
            borderRadius: 14,
            border: "none",
            background: "var(--primary-btn-bg)",
            color: "var(--primary-btn-fg)",
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Weiter zum Dashboard
        </Link>
      </div>
    </div>
  );
}
