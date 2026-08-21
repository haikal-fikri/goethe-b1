import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getUebersichtData, auditLabel, auditTone } from "@/lib/uebersicht";
import { PageShell, PageHeader, StatCard, SectionCard, NotAvailable, EmptyRow } from "@/components/ui/page";
import { IconShieldCheck, IconChevronRight } from "@/components/icons";
import { relativeDe } from "@/lib/format";
import { RollenKarte } from "@/components/uebersicht/RollenKarte";

export const dynamic = "force-dynamic";

/** null (nicht lesbar) wird als „—" gerendert, nie als 0. */
const num = (v: number | null) => (v === null ? "—" : v.toLocaleString("de-DE"));

export default async function UebersichtPage() {
  const sb = await supabaseServer();
  const d = await getUebersichtData(sb);

  return (
    <PageShell>
      <PageHeader eyebrow="Ops" title="Plattform-Übersicht" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 22 }}>
        <StatCard label="Konten" value={num(d.konten)} sub="inkl. Lernende" />
        <StatCard label="Aktive Abos" value={num(d.aktiveAbos)} sub="Lehrkräfte" />
        <StatCard label="Organisationen" value={num(d.organisationen)} sub="Teams mit Sitzen" />
        <StatCard label="Klassen" value={num(d.klassen)} sub="inkl. archivierter" />
        <StatCard label="Einschreibungen" value={num(d.einschreibungen)} sub="aktiv" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        <SectionCard title="Aufmerksamkeit nötig">
          {d.avvOffen === null ? (
            <EmptyRow>Konnte nicht geprüft werden.</EmptyRow>
          ) : d.avvOffen === 0 ? (
            <EmptyRow>Alle Lehrkräfte mit aktivem Abo haben die aktuelle AVV akzeptiert.</EmptyRow>
          ) : (
            <Link
              href="/dsgvo"
              className="hover-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 13,
                borderRadius: 13,
                border: "1px solid color-mix(in oklab, var(--gold) 40%, transparent)",
                background: "var(--gold-tint)",
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  flex: "0 0 34px",
                  background: "var(--surface-1)",
                  color: "var(--gold-text)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconShieldCheck size={17} strokeWidth={1.9} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-hi)" }}>
                  {d.avvOffen} {d.avvOffen === 1 ? "Lehrkraft" : "Lehrkräfte"} ohne aktuelle AVV
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                  Zustimmung zur Version steht aus
                </div>
              </div>
              <IconChevronRight size={16} strokeWidth={1.9} style={{ color: "var(--text-3)" }} />
            </Link>
          )}

          <NotAvailable
            title="Zahlungsstatus & Systemzustand"
            reason="Die Konsole hat keinen Lesezugriff auf Zahlungsbeträge (billing_events speichert nur Ereignis-IDs) und keine Uptime-/Latenz-Erfassung. Beides zeigt die Comp, gestützt wird es nicht."
            style={{ marginTop: 12 }}
          />
        </SectionCard>

        <SectionCard title="Rollen verwalten">
          <p style={{ margin: "0 0 16px", fontSize: 12.5, lineHeight: 1.6, color: "var(--text-2)" }}>
            Vergibt <code style={{ fontFamily: "var(--font-mono)" }}>teacher</code> oder{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>admin</code>. Höchstens fünf Vergaben
            pro Tag, jede wird protokolliert.
          </p>
          <RollenKarte />
        </SectionCard>

        <SectionCard
          title="Letzte Aktivität"
          style={{ gridColumn: "1 / -1" }}
          right={<Link href="/dsgvo" style={{ fontSize: 12.5, fontWeight: 600 }}>Protokoll</Link>}
        >
          {d.aktivitaet.length === 0 ? (
            <EmptyRow>Noch keine protokollierten Vorgänge.</EmptyRow>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {d.aktivitaet.map((a) => (
                <div
                  key={a.id}
                  style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: "1px solid var(--border-1)" }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      marginTop: 6,
                      flex: "0 0 8px",
                      background: auditTone(a.action),
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--text-hi)" }}>{auditLabel(a.action)}</div>
                    {a.target ? (
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
                        {a.target}
                      </div>
                    ) : null}
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                    {relativeDe(a.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}
