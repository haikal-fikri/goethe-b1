"use client";
import type { ReactNode } from "react";

// Gesamtergebnis-Karte (Punkte / Prozent / Bestehen-Status + Schwellen-Balken).
// Geteilt von Schreiben- und Sprechen-Review. Zahlen in der Serifenschrift.

export function statusOf(pct: number): { label: string; color: string; tint: string } {
  if (pct >= 60) return { label: "Bestanden", color: "var(--gruen)", tint: "var(--gruen-tint)" };
  if (pct >= 50) return { label: "Knapp", color: "var(--gold-text)", tint: "var(--gold-tint)" };
  return { label: "Nicht bestanden", color: "var(--rot-text)", tint: "var(--rot-tint)" };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

export function ScoreSummary({
  total,
  max,
  extra,
}: {
  total: number;
  max: number;
  extra?: ReactNode;
}) {
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  const status = statusOf(pct);
  const schwelle = Math.round(max * 0.6 * 10) / 10;

  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border-1)", borderRadius: 18, padding: "18px 20px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-2)" }}>
          Gesamtergebnis
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: status.color,
            background: status.tint,
            padding: "4px 11px",
            borderRadius: 999,
          }}
        >
          {status.label}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 40, fontWeight: 600, color: "var(--text-hi)", lineHeight: 1 }}>
            {fmt(total)}
          </span>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--text-2)" }}>/ {fmt(max)}</span>
          <span style={{ fontSize: 13, color: "var(--text-2)", marginLeft: 2 }}>Punkte</span>
        </div>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600, color: status.color }}>{pct}%</span>
      </div>

      <div style={{ height: 8, borderRadius: 999, background: "var(--track-1)", overflow: "hidden", marginBottom: 10 }}>
        <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: 999, background: status.color, transition: "width .4s var(--ease)" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>
          Bestehen ab <span style={{ fontFamily: "var(--font-serif)", color: "var(--text-1)" }}>{fmt(schwelle)}</span> Punkten (60%)
        </span>
      </div>

      {extra}
    </div>
  );
}
