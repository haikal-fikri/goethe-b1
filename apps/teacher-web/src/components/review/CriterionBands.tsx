"use client";
import type { CriterionBand } from "@repo/types";

// A–E-Band-Auswahl je Kriterium. Der Lehrer wählt das Band; die Punkte rechnet
// der Aufrufer (pointsFromBands/criterionPoints aus @repo/core) — und final der
// Server neu. KI-Vorschlag = lila Punkt unter dem vorgeschlagenen Band.

export const BANDS: CriterionBand[] = ["A", "B", "C", "D", "E"];

const BAND_DESC: Record<CriterionBand, string> = {
  A: "A · voll erfüllt",
  B: "B · gut",
  C: "C · teilweise",
  D: "D · knapp",
  E: "E · nicht erfüllt",
};

export interface CritItem {
  key: string;
  label: string;
  pts: number;
  max: number;
  aiBand?: CriterionBand;
  begruendung?: string;
  manual?: boolean; // kein KI-Vorschlag (z. B. Aussprache)
}

export function CriterionBands({
  items,
  value,
  onSet,
}: {
  items: CritItem[];
  value: Record<string, CriterionBand>;
  onSet: (key: string, band: CriterionBand) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
      {items.map((c) => {
        const overridden = c.aiBand != null && value[c.key] !== c.aiBand;
        return (
          <div key={c.key} style={{ background: "var(--bg)", border: "1px solid var(--border-1)", borderRadius: 16, padding: "15px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-hi)" }}>{c.label}</span>
                {overridden ? <MiniBadge tone="gruen">geändert</MiniBadge> : null}
                {c.manual ? <MiniBadge tone="neutral">manuell</MiniBadge> : null}
              </div>
              <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: ptsColor(c.pts, c.max) }}>{fmt(c.pts)}</span> /{" "}
                {fmt(c.max)} Pkt.
              </span>
            </div>

            <div style={{ display: "flex", gap: 7, marginBottom: c.begruendung ? 10 : 0, flexWrap: "wrap" }}>
              {BANDS.map((b) => {
                const active = value[c.key] === b;
                const isAi = c.aiBand === b;
                return (
                  <button
                    key={b}
                    onClick={() => onSet(c.key, b)}
                    title={BAND_DESC[b]}
                    className="press"
                    style={{
                      position: "relative",
                      width: 42,
                      height: 38,
                      borderRadius: 9,
                      cursor: "pointer",
                      fontFamily: "var(--font-serif)",
                      fontSize: 16,
                      fontWeight: 600,
                      border: active ? "1.5px solid var(--gruen)" : "1px solid var(--border-1)",
                      background: active ? "var(--gruen-tint)" : "var(--bg)",
                      color: active ? "var(--gruen)" : "var(--text-2)",
                    }}
                  >
                    {b}
                    {isAi ? (
                      <span
                        style={{
                          position: "absolute",
                          bottom: -8,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 4,
                          height: 4,
                          borderRadius: 999,
                          background: "var(--lila)",
                        }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {c.begruendung ? (
              <div
                style={{
                  display: "flex",
                  gap: 9,
                  background: c.manual ? "var(--surface-alt)" : "var(--lila-tint)",
                  borderRadius: 11,
                  padding: "10px 12px",
                }}
              >
                <span
                  style={{
                    flex: "0 0 auto",
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: ".06em",
                    color: c.manual ? "var(--text-2)" : "var(--lila)",
                    background: "var(--surface-1)",
                    padding: "2px 6px",
                    borderRadius: 6,
                    height: "fit-content",
                  }}
                >
                  {c.manual ? "Manuell" : `KI · ${c.aiBand ?? ""}`}
                </span>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: c.manual ? "var(--text-2)" : "var(--text-1)" }}>
                  {c.begruendung}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function MiniBadge({ children, tone }: { children: React.ReactNode; tone: "gruen" | "neutral" }) {
  const c = tone === "gruen" ? { color: "var(--gruen)", bg: "var(--gruen-tint)" } : { color: "var(--text-2)", bg: "var(--surface-alt)" };
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, color: c.color, background: c.bg, padding: "2px 7px", borderRadius: 999 }}>
      {children}
    </span>
  );
}

function ptsColor(pts: number, max: number): string {
  const r = max > 0 ? pts / max : 0;
  if (r >= 0.75) return "var(--gruen)";
  if (r >= 0.5) return "var(--gold-text)";
  if (pts === 0) return "var(--rot-text)";
  return "var(--text-hi)";
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}
