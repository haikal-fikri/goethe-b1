"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import { authedFetch } from "@/lib/api";

// Öffnet das Kundenportal (Rechnungen, Zahlungsmittel, Kündigen): POST
// /api/billing/portal → { url } → Weiterleitung. Zwei Darstellungen: „link"
// (Textlink im Tarif-Kopf) und „outline" (Button in der Rechnungen-Karte).

export function PortalButton({
  label = "Abo verwalten",
  variant = "link",
  style,
}: {
  label?: string;
  variant?: "link" | "outline";
  style?: CSSProperties;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await authedFetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) {
        setErr("Verwaltung derzeit nicht verfügbar.");
        setBusy(false);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.assign(data.url); // Weiterleitung läuft — busy bleibt aktiv
        return;
      }
      setErr("Unerwartete Antwort.");
      setBusy(false);
    } catch {
      setErr("Netzwerkfehler.");
      setBusy(false);
    }
  }

  if (variant === "link") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
        <button
          onClick={go}
          disabled={busy}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--gruen)",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
            ...style,
          }}
        >
          {busy ? "Öffnen…" : `${label} ↗`}
        </button>
        {err ? <span style={{ fontSize: 11.5, color: "var(--rot-text)" }}>{err}</span> : null}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
      <button
        onClick={go}
        disabled={busy}
        className="hover-strong press"
        style={{
          height: 42,
          padding: "0 18px",
          borderRadius: 12,
          border: "1px solid var(--border-strong)",
          background: "var(--bg)",
          color: "var(--text-hi)",
          fontSize: 13.5,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          whiteSpace: "nowrap",
          opacity: busy ? 0.75 : 1,
          ...style,
        }}
      >
        {busy ? "Öffnen…" : label}
      </button>
      {err ? (
        <span style={{ fontSize: 12, color: "var(--rot-text)", textAlign: "center" }}>{err}</span>
      ) : null}
    </div>
  );
}
