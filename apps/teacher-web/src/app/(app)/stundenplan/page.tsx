import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getScheduleOverview } from "@/lib/stundenplan";
import { Eyebrow } from "@/components/ui/primitives";
import { SessionList } from "@/components/stundenplan/SessionList";
import { NewSessionButton } from "@/components/stundenplan/NewSessionButton";

export const dynamic = "force-dynamic";

export default async function StundenplanPage() {
  await requireAuth("/stundenplan");
  const sb = await supabaseServer();
  const data = await getScheduleOverview(sb);
  const hasClasses = data.classes.length > 0;

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "30px 34px 60px" }}>
      {/* Kopf */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 24 }}>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Stundenplan</Eyebrow>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600, color: "var(--text-hi)", margin: 0, letterSpacing: "-.01em" }}>
            Stundenplan &amp; Anwesenheit
          </h1>
        </div>
        {hasClasses ? <NewSessionButton classes={data.classes} /> : null}
      </div>

      {!hasClasses ? (
        <Card>
          <Empty>Legen Sie zuerst eine Klasse an, um Termine zu planen und Anwesenheit zu erfassen.</Empty>
        </Card>
      ) : (
        <>
          {/* Wochenpläne je Klasse (wiederkehrende Regeln) */}
          {data.schedules.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              {data.schedules.map((g) => (
                <div
                  key={g.classId}
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--border-1)",
                    borderRadius: 18,
                    boxShadow: "var(--shadow-card-now)",
                    padding: "20px 22px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                    <Eyebrow style={{ letterSpacing: ".1em" }}>Wochenplan · {g.className}</Eyebrow>
                    <span style={{ fontSize: 12, color: "var(--text-2)" }}>Zeitzone: {g.timezone}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {g.rules.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "12px 14px",
                          border: "1px solid var(--border-1)",
                          borderRadius: 12,
                        }}
                      >
                        <span
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            flex: "0 0 30px",
                            background: "var(--gruen-tint)",
                            color: "var(--gruen)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {r.weekdayShort}
                        </span>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text-hi)" }}>{r.weekdayLong}</span>
                        <span style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--text-hi)" }}>{r.time}</span>
                        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{r.durationMin} Min</span>
                      </div>
                    ))}
                    <NewSessionButton
                      classes={data.classes}
                      preselectClassId={g.classId}
                      variant="dashed"
                      label="Einzeltermin hinzufügen"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <Eyebrow style={{ letterSpacing: ".1em", marginBottom: 6 }}>Wochenplan</Eyebrow>
                  <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-2)" }}>
                    Noch keine wiederkehrenden Zeiten hinterlegt. Legen Sie Einzeltermine an.
                  </p>
                </div>
                <NewSessionButton classes={data.classes} label="Einzeltermin hinzufügen" />
              </div>
            </Card>
          )}

          {/* Kommende Termine */}
          <Eyebrow style={{ letterSpacing: ".12em", marginBottom: 12 }}>Termine</Eyebrow>
          <div
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-1)",
              borderRadius: 18,
              boxShadow: "var(--shadow-card-now)",
              padding: data.upcoming.length > 0 ? "6px 22px" : "0",
              marginBottom: data.recent.length > 0 ? 28 : 0,
            }}
          >
            {data.upcoming.length > 0 ? (
              <SessionList sessions={data.upcoming} />
            ) : (
              <Empty>Keine kommenden Termine geplant.</Empty>
            )}
          </div>

          {/* Vergangene Termine (Anwesenheit nachtragen) */}
          {data.recent.length > 0 ? (
            <>
              <Eyebrow style={{ letterSpacing: ".12em", marginBottom: 12 }}>Vergangene Termine</Eyebrow>
              <div
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-1)",
                  borderRadius: 18,
                  boxShadow: "var(--shadow-card-now)",
                  padding: "6px 22px",
                }}
              >
                <SessionList sessions={data.recent} />
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-1)",
        borderRadius: 20,
        boxShadow: "var(--shadow-card-now)",
        padding: "20px 22px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "28px 0", fontSize: 13.5, color: "var(--text-2)", textAlign: "center" }}>{children}</div>;
}
