import { supabaseServer } from "@/lib/supabase/server";
import { getAnalyticsData } from "@/lib/analytics";
import { PageShell, PageHeader, SectionCard, StatCard, NotAvailable, EmptyRow } from "@/components/ui/page";

export const dynamic = "force-dynamic";

const SERIEN = [
  { key: "schreiben", label: "Schreiben", color: "var(--gruen)" },
  { key: "sprechen", label: "Sprechen", color: "var(--blau)" },
  { key: "pruefung", label: "Simulation", color: "var(--lila)" },
] as const;

export default async function AnalyticsPage() {
  const sb = await supabaseServer();
  const d = await getAnalyticsData(sb);
  const max = Math.max(1, ...d.balken.map((b) => b.gesamt));
  const letzte = d.balken[d.balken.length - 1];
  const vorletzte = d.balken[d.balken.length - 2];
  const delta =
    letzte && vorletzte && vorletzte.gesamt > 0
      ? Math.round(((letzte.gesamt - vorletzte.gesamt) / vorletzte.gesamt) * 100)
      : null;

  return (
    <PageShell>
      <PageHeader eyebrow="Analytics" title="Plattform-Analytics" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Bewertungen (8 Wochen)" value={d.lesbar ? d.gesamt : "—"} />
        <StatCard label="Diese Woche" value={d.lesbar && letzte ? letzte.gesamt : "—"} />
        <StatCard
          label="Gegenüber Vorwoche"
          value={delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}
          subColor={delta !== null && delta < 0 ? "var(--rot-text)" : "var(--gruen)"}
        />
      </div>

      <SectionCard
        title="Bewertungen pro Woche"
        right={
          <div style={{ display: "flex", gap: 14 }}>
            {SERIEN.map((s) => (
              <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        }
      >
        {!d.lesbar ? (
          <EmptyRow>Bewertungsdaten konnten nicht gelesen werden.</EmptyRow>
        ) : (
          <>
            {d.fehlend.length > 0 ? (
              <div style={{ fontSize: 12, color: "var(--gold-text)", marginBottom: 12 }}>
                Ohne {d.fehlend.join(" und ")} — nicht lesbar.
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 190, paddingTop: 8 }}>
              {d.balken.map((b) => (
                <div
                  key={b.woche}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    height: "100%",
                    justifyContent: "flex-end",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 13, fontWeight: 600, color: "var(--text-hi)" }}>
                    {b.gesamt}
                  </span>
                  {/* Gestapelt: die Höhe des Stapels ist gesamt/max der Achse. */}
                  <div
                    title={`${b.label}: ${b.schreiben} Schreiben, ${b.sprechen} Sprechen, ${b.pruefung} Simulationen`}
                    style={{
                      width: "100%",
                      height: `${(b.gesamt / max) * 100}%`,
                      minHeight: b.gesamt > 0 ? 4 : 2,
                      borderRadius: 6,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column-reverse",
                      background: b.gesamt === 0 ? "var(--track-1)" : "transparent",
                    }}
                  >
                    {SERIEN.map((s) =>
                      b[s.key] > 0 ? (
                        <div key={s.key} style={{ height: `${(b[s.key] / b.gesamt) * 100}%`, background: s.color }} />
                      ) : null
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-2)" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
        <NotAvailable
          title="Aktive Nutzende (WAU/MAU) und Aktivierungs-Funnel"
          reason="Es gibt keine Sitzungs- oder Ereigniserfassung. Aus Einschreibungen und Bewertungen ließe sich beides nur schätzen — eine Schätzung, die wie eine Messung aussieht, ist schlechter als keine Zahl."
        />
        <NotAvailable
          title="Prüfungsbereitschaft und Retention"
          reason="readiness_snapshots existiert, ist aber lernendenbezogen und ohne Kohortenmodell nicht zu einer Plattform-Kennzahl aggregierbar. Retention bräuchte zusätzlich eine Kündigungshistorie; entitlements hält nur den aktuellen Stand."
        />
      </div>
    </PageShell>
  );
}
