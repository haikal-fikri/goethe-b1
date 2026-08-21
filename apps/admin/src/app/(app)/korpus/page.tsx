import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { listSimulations, RESOURCES, PUBLIC_SIMULATION_LIMIT } from "@/lib/korpus";
import { PageShell, PageHeader, SectionCard, EmptyRow } from "@/components/ui/page";
import { Card, Pill } from "@/components/ui/primitives";
import { Button } from "@/components/ui/controls";
import { IconBook, IconPlus, IconChevronRight } from "@/components/icons";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const COLS = "2.4fr 0.8fr 0.9fr 1.1fr 1fr";

export default async function KorpusPage() {
  const sb = await supabaseServer();
  const sims = await listSimulations(sb);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Prüfungs-Korpus"
        title="Exam-Inhalte"
        right={
          <Link href="/korpus/neu" style={{ textDecoration: "none" }}>
            <Button variant="accent" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconPlus size={17} strokeWidth={2} />
              Simulation anlegen
            </Button>
          </Link>
        }
      />

      <Card radius={18} padded={false} style={{ overflow: "hidden", marginBottom: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 12,
            padding: "13px 20px",
            borderBottom: "1px solid var(--border-1)",
          }}
        >
          {["Simulation", "Aufgaben", "Reihenfolge", "Angelegt", "Öffentlich"].map((h) => (
            <span
              key={h}
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: ".09em",
                textTransform: "uppercase",
                color: "var(--text-2)",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {sims.length === 0 ? (
          <div style={{ padding: "18px 20px" }}>
            <EmptyRow>Noch keine Simulationen angelegt.</EmptyRow>
          </div>
        ) : (
          sims.map((s) => (
            <Link
              key={s.id}
              href={`/korpus/${s.id}`}
              className="hover-surface"
              style={{
                display: "grid",
                gridTemplateColumns: COLS,
                gap: 12,
                alignItems: "center",
                padding: "12px 20px",
                borderTop: "1px solid var(--border-1)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    flex: "0 0 32px",
                    background: "var(--lila-tint)",
                    color: "var(--lila)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconBook size={16} strokeWidth={1.7} />
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--text-hi)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.titleDe}
                </span>
              </div>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--text-hi)" }}>
                {s.aufgaben}
              </span>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--text-hi)" }}>
                {s.sortOrder}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{shortDate(s.createdAt)}</span>
              <span style={{ justifySelf: "start" }}>
                {s.oeffentlich ? <Pill tone="gruen">Web + App</Pill> : <Pill tone="neutral">nur App</Pill>}
              </span>
            </Link>
          ))
        )}
      </Card>

      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-2)", margin: "0 0 24px" }}>
        Die öffentliche Web-App zeigt nur die ersten {PUBLIC_SIMULATION_LIMIT} Simulationen
        (nach Reihenfolge, dann ID) — der anonyme Bewertungspfad lehnt Aufgaben darüber hinaus
        ebenfalls ab. Alles Weitere ist der mobilen App vorbehalten. Eine neu angelegte Simulation
        taucht auf <code style={{ fontFamily: "var(--font-mono)" }}>/pruefen</code> also
        absichtlich nicht auf.
      </p>

      <SectionCard title="Weitere Inhalte">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {RESOURCES.map((r) => (
            <Link
              key={r.slug}
              href={`/korpus/inhalte/${r.slug}`}
              className="hover-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 14px",
                borderRadius: 13,
                border: "1px solid var(--border-1)",
                background: "var(--bg)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-hi)" }}>{r.titel}</div>
                <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.45 }}>{r.beschreibung}</div>
              </div>
              <IconChevronRight size={16} strokeWidth={1.9} style={{ color: "var(--text-3)" }} />
            </Link>
          ))}
        </div>
      </SectionCard>
    </PageShell>
  );
}
