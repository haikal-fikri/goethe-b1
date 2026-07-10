import type { CSSProperties, ReactNode } from "react";
import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getAboData, PLAN_PRICE, type AboData } from "@/lib/abo";
import { Eyebrow, ProgressBar } from "@/components/ui/primitives";
import { IconAlertTriangle } from "@/components/icons";
import { PaywallLauncher } from "@/components/abo/Paywall";
import { PortalButton } from "@/components/abo/PortalButton";
import { ProSuccess } from "@/components/abo/ProSuccess";

export const dynamic = "force-dynamic";

// Datum mit Jahr, z. B. „1. März 2027".
function fullDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

// Monatslabel aus 'YYYY-MM' (UTC), z. B. „Juli 2026".
function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return "";
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function statusLabel(d: AboData): string {
  if (d.active) return "aktiv";
  switch (d.status) {
    case "canceled":
      return d.currentPeriodEnd ? `gekündigt · Zugang bis ${fullDate(d.currentPeriodEnd)}` : "gekündigt";
    case "past_due":
      return "Zahlung offen";
    case "revoked":
    case "expired":
      return "abgelaufen";
    default:
      return "aktiv"; // Standard-Starter ohne Abo-Row
  }
}

export default async function AboPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string | string[] }>;
}) {
  const user = await requireAuth("/abo");
  const sb = await supabaseServer();
  const data = await getAboData(sb, user.id);
  const params = await searchParams;
  const showSuccess = params?.upgraded === "1";

  const isPro = data.plan === "pro";
  const price = PLAN_PRICE[data.plan];
  const audioPct =
    data.audioCapMin && data.audioCapMin > 0
      ? Math.min(100, Math.round((data.audioMinutes / data.audioCapMin) * 100))
      : 0;
  const nearFairUse = data.audioCapMin != null && audioPct >= 80;

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "30px 34px 60px" }}>
      <Eyebrow style={{ marginBottom: 8 }}>Abo</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 24px", letterSpacing: "-.01em" }}>
        Abo &amp; Nutzung
      </h1>

      {/* Cap-Hinweis (nur Starter am Limit) */}
      {data.atCap ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid color-mix(in oklab, var(--gold) 40%, transparent)",
            background: "var(--gold-tint)",
            marginBottom: 18,
          }}
        >
          <IconAlertTriangle size={18} style={{ color: "var(--gold-text)", flex: "0 0 auto" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-hi)" }}>
              Sie haben ein Starter-Limit erreicht
            </div>
            <div style={{ fontSize: 12.5, color: "var(--gold-text)" }}>
              Mit Pro legen Sie unbegrenzt viele Klassen an — faire Nutzung statt harter Limits.
            </div>
          </div>
          <PaywallLauncher
            currentPlan={data.plan}
            label="Jetzt upgraden"
            triggerStyle={{
              height: 40,
              padding: "0 16px",
              borderRadius: 11,
              border: "none",
              background: "var(--gruen)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "var(--glow-gruen)",
            }}
          />
        </div>
      ) : null}

      {/* Tarif-Karte */}
      <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 20, boxShadow: "var(--shadow-card-now)", padding: 24, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 22 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: isPro ? "#fff" : "var(--gruen)",
                  background: isPro ? "var(--gruen)" : "var(--gruen-tint)",
                  padding: "4px 10px",
                  borderRadius: 999,
                }}
              >
                {isPro ? "Pro" : "Starter"}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>{statusLabel(data)}</span>
            </div>
            {data.hasBilling ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 34, fontWeight: 600, color: "var(--text-hi)" }}>{price.amount}</span>
                  <span style={{ fontSize: 14, color: "var(--text-2)" }}>{price.period}</span>
                </div>
                {data.active && data.currentPeriodEnd ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
                    Verlängert sich am {fullDate(data.currentPeriodEnd)}
                  </div>
                ) : null}
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>
                Kostenloser Zugang · jederzeit auf Pro upgraden
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch", minWidth: 172 }}>
            {!isPro ? (
              <PaywallLauncher
                currentPlan={data.plan}
                label="Auf Pro upgraden"
                triggerStyle={{
                  height: 42,
                  padding: "0 18px",
                  borderRadius: 12,
                  border: "none",
                  background: "var(--primary-btn-bg)",
                  color: "var(--primary-btn-fg)",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              />
            ) : null}
            {data.hasBilling ? <PortalButton label="Abo verwalten" variant="link" /> : null}
          </div>
        </div>

        {/* Nutzungs-Messer: Klassen + Teilnehmende gegen Plan-Obergrenze */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, paddingTop: 20, borderTop: "1px solid var(--border-1)" }}>
          <CapMeter
            label="Klassen"
            used={data.classesUsed}
            cap={data.classesCap}
            fullNote="Limit erreicht — Upgrade für unbegrenzt"
            freeNote={(r) => `Noch ${r} ${r === 1 ? "Klasse" : "Klassen"} frei`}
          />
          <CapMeter
            label="Teilnehmende"
            used={data.studentsUsed}
            cap={data.studentsCap}
            fullNote="Limit erreicht — Upgrade für mehr Plätze"
            freeNote={(r) => `Noch ${r} ${r === 1 ? "Platz" : "Plätze"} frei`}
          />
        </div>
      </div>

      {/* Nutzung diesen Monat (reale usage_counters-Werte) */}
      <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 20, boxShadow: "var(--shadow-card-now)", padding: "22px 24px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-2)" }}>
            Nutzung · {monthLabel(data.period)}
          </div>
          {nearFairUse ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--gold-text)", background: "var(--gold-tint)", padding: "4px 10px", borderRadius: 999 }}>
              Nähert sich der fairen Nutzung
            </span>
          ) : null}
        </div>

        {isPro && data.audioCapMin != null ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-1)" }}>Bewertete Audio-Minuten</span>
              <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--text-hi)" }}>{data.audioMinutes}</span> / {data.audioCapMin} min · {audioPct}%
              </span>
            </div>
            <ProgressBar value={audioPct} color={nearFairUse ? "var(--gold)" : "var(--gruen)"} height={8} />
            <p style={{ margin: "12px 0 16px", fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>
              Im Pro-Tarif gelten faire Nutzungsgrenzen statt harter Limits. Bei anhaltender Überschreitung meldet
              sich unser Team.
            </p>
            <div style={{ display: "flex", gap: 28, borderTop: "1px solid var(--border-1)", paddingTop: 16 }}>
              <UsageStat value={data.writingGrades} label="KI-Bewertungen Schreiben" />
              <UsageStat value={data.speakingGrades} label="KI-Bewertungen Sprechen" />
            </div>
          </>
        ) : data.hasUsage ? (
          <>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <UsageStat value={data.audioMinutes} label="Bewertete Audio-Minuten" unit="min" />
              <UsageStat value={data.writingGrades} label="KI-Bewertungen Schreiben" />
              <UsageStat value={data.speakingGrades} label="KI-Bewertungen Sprechen" />
            </div>
            <p style={{ margin: "16px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>
              Im Starter-Tarif ist die KI-Bewertung ohne feste Minuten-Grenze enthalten.
            </p>
          </>
        ) : (
          <div style={{ padding: "18px 0", fontSize: 13, color: "var(--text-2)", textAlign: "center" }}>
            Noch keine KI-Bewertungen in diesem Monat.
          </div>
        )}
      </div>

      {/* Rechnungen — liegen bei Polar, nicht in unserer DB → Portal-CTA statt erfundener Zeilen */}
      <Eyebrow style={{ marginBottom: 12 }}>Rechnungen</Eyebrow>
      <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 18, boxShadow: "var(--shadow-card-now)", padding: "18px 22px" }}>
        {data.hasBilling ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-2)", display: "flex", flex: "0 0 auto" }}>
              <InvoiceIcon />
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-hi)" }}>
                Rechnungen &amp; Zahlungsbelege
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                Ihre Rechnungen verwalten und als PDF herunterladen Sie sicher im Kundenportal.
              </div>
            </div>
            <PortalButton label="Im Kundenportal öffnen" variant="outline" style={{ minWidth: 190 }} />
          </div>
        ) : (
          <div style={{ padding: "16px 0", fontSize: 13, lineHeight: 1.6, color: "var(--text-2)", textAlign: "center" }}>
            Noch keine Rechnungen — sobald Sie ein kostenpflichtiges Abo abschließen, erscheinen Ihre Belege hier
            bzw. im Kundenportal.
          </div>
        )}
      </div>

      {showSuccess ? <ProSuccess /> : null}
    </div>
  );
}

const rowBaseline: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: 7,
};

/* ── Plan-Cap-Messer (Klassen / Teilnehmende) ─────────────────────── */
function CapMeter({
  label,
  used,
  cap,
  fullNote,
  freeNote,
}: {
  label: string;
  used: number;
  cap: number | null;
  fullNote: string;
  freeNote: (remaining: number) => string;
}) {
  // Pro / unbegrenzt: keine sinnvolle Obergrenze → Zahl + Hinweis, kein Balken.
  if (cap == null) {
    return (
      <div>
        <div style={rowBaseline}>
          <span style={{ fontSize: 13, color: "var(--text-1)" }}>{label}</span>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "var(--text-hi)" }}>{used}</span>
        </div>
        <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>Unbegrenzt im Pro-Tarif</span>
      </div>
    );
  }
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const full = used >= cap;
  const remaining = Math.max(0, cap - used);
  return (
    <div>
      <div style={rowBaseline}>
        <span style={{ fontSize: 13, color: "var(--text-1)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: full ? "var(--gold-text)" : "var(--text-hi)" }}>
          {used} <span style={{ color: "var(--text-2)" }}>/ {cap}</span>
        </span>
      </div>
      <ProgressBar value={pct} color={full ? "var(--gold)" : "var(--gruen)"} height={7} style={{ margin: "7px 0 6px" }} />
      <span style={{ fontSize: 11.5, fontWeight: full ? 600 : 400, color: full ? "var(--gold-text)" : "var(--text-2)" }}>
        {full ? fullNote : freeNote(remaining)}
      </span>
    </div>
  );
}

/* ── Kleine Nutzungs-Kennzahl ─────────────────────────────────────── */
function UsageStat({ value, label, unit }: { value: number; label: string; unit?: string }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600, color: "var(--text-hi)", lineHeight: 1 }}>{value}</span>
        {unit ? <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{unit}</span> : null}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 5 }}>{label}</div>
    </div>
  );
}

/* Lokales Dokument-Icon (kein Shared-Icon nötig → keine icons.tsx-Kollision). */
function InvoiceIcon(): ReactNode {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3v5h5" />
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    </svg>
  );
}
