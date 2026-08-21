import { supabaseServer } from "@/lib/supabase/server";
import { getAbrechnungData, PLAN_COLOR } from "@/lib/abrechnung";
import { PLAN_LABEL, ABO_LABEL, aboTone } from "@/lib/organisationen";
import { PageShell, PageHeader, StatCard, SectionCard, NotAvailable, EmptyRow } from "@/components/ui/page";
import { Pill, ProgressBar } from "@/components/ui/primitives";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AbrechnungPage() {
  const sb = await supabaseServer();
  const d = await getAbrechnungData(sb);

  if (!d.lesbar) {
    return (
      <PageShell>
        <PageHeader eyebrow="Abrechnung" title="Abos & Tarife" />
        <EmptyRow>Abo-Daten konnten nicht gelesen werden.</EmptyRow>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader eyebrow="Abrechnung" title="Abos & Tarife" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Abos gesamt" value={d.gesamt} sub="alle Status" />
        <StatCard label="Aktiv" value={d.aktiv} sub="mit Lehrkraft-Befugnis" />
        <StatCard
          label="Laufen bald aus"
          value={d.laufenAus.length}
          sub="in den nächsten 30 Tagen"
          subColor={d.laufenAus.length > 0 ? "var(--gold-text)" : "var(--text-2)"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <SectionCard title="Verteilung nach Tarif">
          {d.plaene.length === 0 ? (
            <EmptyRow>Noch keine Abos.</EmptyRow>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {d.plaene.map((p) => (
                <div key={p.plan}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "var(--text-1)" }}>{PLAN_LABEL[p.plan] ?? p.plan}</span>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 13.5, color: "var(--text-hi)" }}>
                      {p.anzahl}
                      <span style={{ color: "var(--text-2)", fontSize: 12 }}> · {Math.round(p.anteil)}%</span>
                    </span>
                  </div>
                  <ProgressBar value={p.anteil} color={PLAN_COLOR[p.plan] ?? "var(--blau)"} height={7} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Verteilung nach Status">
          {d.status.length === 0 ? (
            <EmptyRow>Noch keine Abos.</EmptyRow>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {d.status.map((s) => (
                <div
                  key={s.status}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: "1px solid var(--border-1)",
                  }}
                >
                  <Pill tone={aboTone(s.status)}>{ABO_LABEL[s.status] ?? s.status}</Pill>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--text-hi)" }}>
                    {s.anzahl}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Laufen in den nächsten 30 Tagen aus" style={{ marginTop: 18 }}>
        {d.laufenAus.length === 0 ? (
          <EmptyRow>Kein aktives Abo endet in den nächsten 30 Tagen.</EmptyRow>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {d.laufenAus.map((e) => (
              <div
                key={e.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderTop: "1px solid var(--border-1)",
                }}
              >
                <span style={{ flex: 1, fontSize: 13.5, color: "var(--text-hi)" }}>{e.name}</span>
                <Pill tone="neutral">{PLAN_LABEL[e.plan] ?? e.plan}</Pill>
                <span style={{ fontSize: 12.5, color: "var(--text-2)", width: 110, textAlign: "right" }}>
                  {shortDate(e.endet)}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <NotAvailable
        title="Umsatz, Rechnungen und Retention"
        reason="Beträge liegen ausschließlich bei Polar. Die Konsole speichert von Zahlungsereignissen nur die Ereignis-ID zur Idempotenz (billing_events, ohne Betrag und ohne Admin-Lesezugriff). MRR/ARR/Rechnungsliste wären hier erfundene Zahlen — sie stehen im Polar-Dashboard."
        style={{ marginTop: 18 }}
      />
    </PageShell>
  );
}
