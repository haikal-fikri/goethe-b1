import { supabaseServer } from "@/lib/supabase/server";
import { getDsgvoData, COMPLIANCE_LABEL } from "@/lib/dsgvo";
import { PageShell, PageHeader, SectionCard, StatCard, NotAvailable, EmptyRow } from "@/components/ui/page";
import { Pill, ProgressBar } from "@/components/ui/primitives";
import { relativeDe, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DsgvoPage() {
  const sb = await supabaseServer();
  const d = await getDsgvoData(sb);

  const nenner = d.aktiveLehrkraefte;
  const zaehler = d.aktuellZugestimmt;
  const quote = nenner && nenner > 0 && zaehler !== null ? Math.round((zaehler / nenner) * 100) : null;

  return (
    <PageShell>
      <PageHeader eyebrow="DSGVO & Compliance" title="Datenschutz-Zentrale" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Aktuelle AVV" value={<span style={{ fontSize: 22 }}>{d.aktuelleVersion}</span>} />
        <StatCard
          label="Zustimmungsquote"
          value={quote === null ? "—" : `${quote}%`}
          sub={
            zaehler !== null && nenner !== null
              ? `${zaehler} von ${nenner} Lehrkräften mit aktivem Abo`
              : "nicht lesbar"
          }
          subColor={quote !== null && quote < 100 ? "var(--gold-text)" : "var(--text-2)"}
        />
        <StatCard
          label="Protokollierte Vorgänge"
          value={d.vorgaengeLesbar ? d.vorgaenge.length : "—"}
          sub="letzte 50"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 18, alignItems: "start" }}>
        <SectionCard title="AVV-Versionen">
          {d.versionen.length === 0 ? (
            <EmptyRow>Keine Zustimmungen lesbar.</EmptyRow>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              {d.versionen.map((v) => {
                const pct = nenner && nenner > 0 ? Math.min(100, (v.zustimmungen / nenner) * 100) : 0;
                return (
                  <div key={v.version}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-hi)" }}>{v.version}</span>
                      {v.istAktuell ? <Pill tone="gruen">aktuell</Pill> : <Pill tone="neutral">abgelöst</Pill>}
                      <span style={{ flex: 1 }} />
                      <span style={{ fontFamily: "var(--font-serif)", fontSize: 13.5, color: "var(--text-hi)" }}>
                        {v.zustimmungen}
                        {nenner !== null ? <span style={{ color: "var(--text-2)", fontSize: 12 }}>/{nenner}</span> : null}
                      </span>
                    </div>
                    <ProgressBar value={pct} color={v.istAktuell ? "var(--gruen)" : "var(--text-3)"} height={7} />
                    <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 5 }}>
                      {v.letzteZustimmung ? `zuletzt ${shortDate(v.letzteZustimmung)}` : "noch keine Zustimmung"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Compliance-Protokoll">
          {!d.vorgaengeLesbar ? (
            <EmptyRow>Protokoll konnte nicht gelesen werden.</EmptyRow>
          ) : d.vorgaenge.length === 0 ? (
            <EmptyRow>Noch keine Lösch- oder Auskunftsvorgänge protokolliert.</EmptyRow>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {d.vorgaenge.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: "1px solid var(--border-1)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--text-hi)" }}>
                      {COMPLIANCE_LABEL[e.action] ?? e.action}
                    </div>
                    {e.target ? (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--text-2)",
                          fontFamily: "var(--font-mono)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.target}
                      </div>
                    ) : null}
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                    {relativeDe(e.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <NotAvailable
        title="Offene Betroffenenanfragen mit Frist"
        reason="Die Comp zeigt eine Warteschlange mit Fälligkeiten. Dafür bräuchte es eine Workflow-Tabelle für Anfragen — es gibt nur das Protokoll bereits ausgeführter Vorgänge (oben). Anfragen laufen derzeit außerhalb des Systems."
        style={{ marginTop: 18 }}
      />
    </PageShell>
  );
}
