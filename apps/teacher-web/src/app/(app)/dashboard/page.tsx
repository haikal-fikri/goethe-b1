import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard";
import { GradingQueue } from "@/components/dashboard/GradingQueue";
import { Eyebrow, Pill } from "@/components/ui/primitives";
import { IconPlus, IconAlertTriangle, IconChevronRight } from "@/components/icons";
import { timeDe, dayLabel, whenShort } from "@/lib/format";

export const dynamic = "force-dynamic";

function greeting(hour: number): string {
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

export default async function DashboardPage() {
  const user = await requireAuth("/dashboard");
  const sb = await supabaseServer();
  const data = await getDashboardData(sb, user.id);

  const meta = user.user_metadata ?? {};
  const name =
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "";
  const now = new Date();
  const todayLabel = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "30px 34px 60px" }}>
      {/* Kopf */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 22 }}>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>{todayLabel}</Eyebrow>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 32,
              fontWeight: 600,
              color: "var(--text-hi)",
              margin: 0,
              letterSpacing: "-.01em",
            }}
          >
            {greeting(now.getHours())}
            {name ? `, ${name}` : ""}
          </h1>
        </div>
        <Link
          href="/aufgaben/neu"
          className="btn-primary press"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 42,
            padding: "0 16px",
            borderRadius: 12,
            border: "none",
            background: "var(--primary-btn-bg)",
            color: "var(--primary-btn-fg)",
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
            textDecoration: "none",
          }}
        >
          <IconPlus size={17} />
          Neue Aufgabe
        </Link>
      </div>

      {/* Hinweis-Chips (nur, wenn zutreffend) */}
      {data.avvNeeded ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
          <Link
            href="/einstellungen"
            className="press"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "9px 14px",
              borderRadius: 12,
              border: "1px solid color-mix(in oklab, var(--gold) 40%, transparent)",
              background: "var(--gold-tint)",
              color: "var(--gold-text)",
              textDecoration: "none",
            }}
          >
            <IconAlertTriangle size={17} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-hi)" }}>AVV-Annahme nötig</span>
            <span style={{ fontSize: 12.5 }}>— für Klassen- und Bewertungsfunktionen</span>
          </Link>
        </div>
      ) : null}

      {/* Kennzahlen */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <StatCard label="Offene Bewertungen" value={String(data.queue.length)}>
          {data.queue.length > 0 ? (
            <Pill tone="gruen" style={{ fontSize: 12.5, padding: "3px 8px" }}>
              {data.offenWriting} Schreiben · {data.offenSpeaking} Sprechen
            </Pill>
          ) : (
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>alles bewertet</span>
          )}
        </StatCard>
        <StatCard label="Teilnehmende gesamt" value={String(data.studentsTotal)}>
          <span style={{ fontSize: 13, color: "var(--text-2)" }}>
            in {data.classesTotal} {data.classesTotal === 1 ? "Klasse" : "Klassen"}
          </span>
        </StatCard>
        <StatCard label="Nächste Stunde" value={data.nextSession ? timeDe(data.nextSession.startsAt) : "—"}>
          <span style={{ fontSize: 13, color: "var(--text-2)" }}>
            {data.nextSession ? `${data.nextSession.klasse} · ${dayLabel(data.nextSession.startsAt)}` : "keine geplant"}
          </span>
        </StatCard>
      </div>

      {/* Warteschlange */}
      <GradingQueue items={data.queue} />

      {/* Untere Spalten */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <SectionCard title="Heute & kommende Stunden" link={{ href: "/stundenplan", label: "Stundenplan ›" }}>
          {data.sessions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {data.sessions.map((s, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 0", borderTop: "1px solid var(--border-1)" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 50, flex: "0 0 50px" }}>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600, color: "var(--text-hi)", lineHeight: 1.1 }}>
                      {timeDe(s.startsAt)}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-2)" }}>
                      {dayLabel(s.startsAt)}
                    </span>
                  </div>
                  <div style={{ width: 3, height: 34, borderRadius: 2, background: "var(--gruen)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-hi)" }}>{s.klasse}</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)" }}>{s.ort}</div>
                  </div>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--text-2)",
                      background: "var(--surface-alt)",
                      padding: "5px 10px",
                      borderRadius: 999,
                    }}
                  >
                    geplant
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Keine kommenden Stunden geplant.</Empty>
          )}
        </SectionCard>

        <SectionCard title="Ihre Klassen" link={{ href: "/klassen", label: "Alle ›" }}>
          {data.classes.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.classes.map((c) => (
                <Link
                  key={c.id}
                  href="/klassen"
                  className="hover-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    padding: 13,
                    borderRadius: 14,
                    border: "1px solid var(--border-1)",
                    background: "var(--bg)",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      flex: "0 0 38px",
                      background: "var(--cefr-b1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-serif)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#fff",
                    }}
                  >
                    B1
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-hi)" }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                      {c.members} Teilnehmende{c.nextStartsAt ? ` · ${whenShort(c.nextStartsAt)}` : ""}
                    </div>
                  </div>
                  {c.offen > 0 ? (
                    <Pill tone="gruen" style={{ fontSize: 12, padding: "5px 10px" }}>
                      {c.offen} offen
                    </Pill>
                  ) : (
                    <IconChevronRight size={16} style={{ color: "var(--text-3)" }} />
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <Empty>Noch keine Klassen — legen Sie Ihre erste Klasse an.</Empty>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function StatCard({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-1)",
        borderRadius: 18,
        boxShadow: "var(--shadow-card-now)",
        padding: "18px 20px",
      }}
    >
      <Eyebrow style={{ letterSpacing: ".1em", marginBottom: 10 }}>{label}</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 38, fontWeight: 600, color: "var(--text-hi)", lineHeight: 1 }}>
          {value}
        </span>
        {children}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  link,
  children,
}: {
  title: string;
  link: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-1)",
        borderRadius: 20,
        boxShadow: "var(--shadow-card-now)",
        padding: "20px 22px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600, color: "var(--text-hi)", margin: 0 }}>
          {title}
        </h2>
        <Link href={link.href} style={{ fontSize: 12.5, fontWeight: 600 }}>
          {link.label}
        </Link>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "22px 0", fontSize: 13, color: "var(--text-2)", textAlign: "center" }}>{children}</div>
  );
}
