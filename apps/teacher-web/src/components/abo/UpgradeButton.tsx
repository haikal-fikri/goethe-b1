"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import { authedFetch } from "@/lib/api";

// Startet den Checkout: POST /api/billing/checkout mit { plan }. Die Route
// stempelt die authentifizierte user.id serverseitig in die Polar-Metadata und
// liefert { url } (Hosted-Checkout). Bei Erfolg leiten wir dorthin weiter; Fehler
// bleiben inline, ohne die Seite zu verlassen.

export function UpgradeButton({
  plan = "pro",
  label = "Auf Pro upgraden",
  variant = "primary",
  style,
}: {
  plan?: "starter" | "pro";
  label?: string;
  variant?: "primary" | "accent";
  style?: CSSProperties;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await authedFetch("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        setErr("Checkout derzeit nicht verfügbar. Bitte später erneut versuchen.");
        setBusy(false);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.assign(data.url); // Weiterleitung läuft — busy bleibt aktiv
        return;
      }
      setErr("Unerwartete Antwort. Bitte später erneut versuchen.");
      setBusy(false);
    } catch {
      setErr("Netzwerkfehler. Bitte später erneut versuchen.");
      setBusy(false);
    }
  }

  const tone: CSSProperties =
    variant === "accent"
      ? { background: "var(--gruen)", color: "#fff", boxShadow: "var(--glow-gruen)", border: "none" }
      : { background: "var(--primary-btn-bg)", color: "var(--primary-btn-fg)", border: "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
      <button
        onClick={go}
        disabled={busy}
        className="press"
        style={{
          height: 42,
          padding: "0 18px",
          borderRadius: 12,
          fontSize: 13.5,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          whiteSpace: "nowrap",
          opacity: busy ? 0.75 : 1,
          ...tone,
          ...style,
        }}
      >
        {busy ? "Weiterleitung…" : label}
      </button>
      {err ? (
        <span style={{ fontSize: 12, color: "var(--rot-text)", textAlign: "center", lineHeight: 1.4 }}>
          {err}
        </span>
      ) : null}
    </div>
  );
}
