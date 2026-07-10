import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getAttendanceContext } from "@/lib/stundenplan";
import { AttendanceRoster } from "@/components/stundenplan/AttendanceRoster";
import { CancelSessionButton } from "@/components/stundenplan/CancelSessionButton";
import { timeDe, shortDate, dayLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AnwesenheitPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await requireAuth(`/stundenplan/${sessionId}`);
  const sb = await supabaseServer();
  const ctx = await getAttendanceContext(sb, sessionId);
  if (!ctx) notFound();

  const { session, roster } = ctx;
  const canceled = session.status === "canceled";
  const label = `${session.className} · ${dayLabel(session.startsAt)} ${timeDe(session.startsAt)}`;

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 34px 60px" }}>
      <Link
        href="/stundenplan"
        className="press"
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
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Stundenplan
      </Link>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 25, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 4px" }}>
            Anwesenheit erfassen
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-2)" }}>
            {session.className} ·{" "}
            <span style={{ color: "var(--text-hi)" }}>
              {shortDate(session.startsAt)} · {timeDe(session.startsAt)}
            </span>
            {session.title ? ` · ${session.title}` : ""}
          </div>
        </div>
        {!canceled ? <CancelSessionButton sessionId={session.id} sessionLabel={label} /> : null}
      </div>

      {canceled ? (
        <div style={{ marginBottom: 18, padding: "11px 15px", background: "var(--rot-tint)", color: "var(--rot-text)", borderRadius: 12, fontSize: 13.5, fontWeight: 600 }}>
          Dieser Termin ist abgesagt. Anwesenheit lässt sich weiterhin nachtragen.
        </div>
      ) : null}

      <AttendanceRoster sessionId={session.id} markedBy={user.id} roster={roster} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <Link
          href="/stundenplan"
          className="btn-accent press"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 46,
            padding: "0 24px",
            borderRadius: 13,
            border: "none",
            background: "var(--gruen)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "var(--glow-gruen)",
          }}
        >
          Fertig
        </Link>
      </div>
    </div>
  );
}
