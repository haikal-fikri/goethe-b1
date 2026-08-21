import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getSimulation, PUBLIC_SIMULATION_LIMIT } from "@/lib/korpus";
import { PageShell, SectionCard, EmptyRow } from "@/components/ui/page";
import { Card, Pill } from "@/components/ui/primitives";
import { IconChevronLeft } from "@/components/icons";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SimulationDetailPage({
  params,
}: {
  params: Promise<{ simId: string }>;
}) {
  const { simId } = await params;
  const id = Number(simId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const sb = await supabaseServer();
  const sim = await getSimulation(sb, id);
  if (!sim) notFound();

  return (
    <PageShell width={980} style={{ paddingTop: 26 }}>
      <Link
        href="/korpus"
        className="hover-strong"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          color: "var(--text-2)",
          fontSize: 12.5,
          fontWeight: 600,
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <IconChevronLeft size={15} strokeWidth={1.9} />
        Zurück zum Korpus
      </Link>

      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 25,
              fontWeight: 600,
              color: "var(--text-hi)",
              margin: 0,
            }}
          >
            {sim.titleDe}
          </h1>
          {sim.oeffentlich ? <Pill tone="gruen">Web + App</Pill> : <Pill tone="neutral">nur App</Pill>}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>
          ID {sim.id} · {sim.aufgaben} {sim.aufgaben === 1 ? "Aufgabe" : "Aufgaben"} · Reihenfolge{" "}
          {sim.sortOrder} · angelegt {shortDate(sim.createdAt)}
        </div>
        {!sim.oeffentlich ? (
          <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 8, lineHeight: 1.55 }}>
            Nicht in der öffentlichen Web-App sichtbar — dort erscheinen nur die ersten{" "}
            {PUBLIC_SIMULATION_LIMIT} Simulationen. Für die mobile App ist sie verfügbar.
          </div>
        ) : null}
      </div>

      <SectionCard title="Enthaltene Aufgaben">
        {sim.tasks.length === 0 ? (
          <EmptyRow>Diese Simulation hat keine Aufgaben.</EmptyRow>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {sim.tasks.map((t) => (
              <Card key={t.id} radius={14} style={{ background: "var(--bg)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--lila)",
                    }}
                  >
                    {t.aufgabe}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-hi)" }}>{t.titleDe}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                    {t.taskType} · {t.minWords} Wörter
                    {t.recommendedMinutes ? ` · ${t.recommendedMinutes} Min` : ""}
                  </span>
                </div>

                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "var(--text-1)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {t.promptDe}
                </p>

                {t.bulletPointsDe.length > 0 ? (
                  <ul style={{ margin: "0 0 10px", paddingLeft: 18, color: "var(--text-1)" }}>
                    {t.bulletPointsDe.map((b, i) => (
                      <li key={i} style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {t.sampleAnswerDe ? (
                  <details>
                    <summary
                      style={{
                        cursor: "pointer",
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--text-2)",
                      }}
                    >
                      Musterlösung
                    </summary>
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 12.5,
                        lineHeight: 1.7,
                        color: "var(--text-1)",
                        fontFamily: "var(--font-mono)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {t.sampleAnswerDe}
                    </p>
                  </details>
                ) : null}

                <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                  {t.id}
                </div>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
