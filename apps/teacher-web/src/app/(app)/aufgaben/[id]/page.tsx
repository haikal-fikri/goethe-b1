import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getAssignmentDetail, type SubStatus, type SubmissionRow } from "@/lib/aufgaben";
import { AufgabeActions } from "@/components/aufgaben/AufgabeActions";
import { Avatar, Eyebrow, SkillTile } from "@/components/ui/primitives";
import { IconChevronLeft, IconPencil, IconMic } from "@/components/icons";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS: Record<SubStatus, { label: string; color: string; tint: string }> = {
  pending: { label: "ausstehend", color: "var(--text-2)", tint: "var(--surface-alt)" },
  submitted: { label: "eingereicht", color: "var(--gold-text)", tint: "var(--gold-tint)" },
  graded: { label: "bewertet", color: "var(--gruen)", tint: "var(--gruen-tint)" },
};

const SUB_GRID = "1.8fr 1.1fr 1.1fr 130px";

export default async function AufgabeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth(`/aufgaben/${id}`);
  const sb = await supabaseServer();
  const a = await getAssignmentDetail(sb, id);
  if (!a) notFound();

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 34px 60px" }}>
      <Link
        href="/aufgaben"
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
        <IconChevronLeft size={15} />
        Alle Aufgaben
      </Link>

      {/* Kopf */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 15, marginBottom: 24 }}>
        <SkillTile skill={a.skill} size={48} radius={13}>
          {a.skill === "schreiben" ? <IconPencil size={23} /> : <IconMic size={23} />}
        </SkillTile>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 25, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 4px" }}>
            {a.title}
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-2)" }}>
            {a.klasse} · Fällig {a.dueAt ? shortDate(a.dueAt) : "—"} ·{" "}
            <span style={{ fontFamily: "var(--font-serif)", color: "var(--text-1)" }}>{a.submitted}</span>/{a.enrolled} eingereicht ·{" "}
            <span style={{ fontFamily: "var(--font-serif)", color: "var(--gruen)" }}>{a.toGrade}</span> zu bewerten
          </div>
        </div>
        <AufgabeActions id={a.id} title={a.title} />
      </div>

      {/* Aufgabenstellung */}
      {a.promptDe || a.instructionsDe ? (
        <>
          <Eyebrow style={{ marginBottom: 12 }}>Aufgabenstellung</Eyebrow>
          <div
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-1)",
              borderRadius: 18,
              boxShadow: "var(--shadow-card-now)",
              padding: "20px 22px",
              marginBottom: 26,
            }}
          >
            {a.taskType ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 10 }}>{a.taskType}</div>
            ) : null}
            {a.promptDe ? (
              <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13.5, lineHeight: 1.7, color: "var(--text-hi)", whiteSpace: "pre-wrap" }}>
                {a.promptDe}
              </p>
            ) : null}
            {a.bulletPoints.length > 0 ? (
              <ul style={{ margin: "14px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                {a.bulletPoints.map((b, i) => (
                  <li key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, color: "var(--text-1)" }}>
                    {b}
                  </li>
                ))}
              </ul>
            ) : null}
            {a.instructionsDe ? (
              <p style={{ margin: `${a.promptDe ? 14 : 0}px 0 0`, fontSize: 13.5, lineHeight: 1.7, color: "var(--text-1)" }}>
                {a.instructionsDe}
              </p>
            ) : null}
            {(a.minWords != null || a.recommendedMinutes != null) ? (
              <div style={{ display: "flex", gap: 18, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-1)" }}>
                {a.minWords != null ? <Meta label="Mindestwörter" value={String(a.minWords)} /> : null}
                {a.recommendedMinutes != null ? <Meta label="Empf. Minuten" value={String(a.recommendedMinutes)} /> : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {/* Einreichungen */}
      <Eyebrow style={{ marginBottom: 12 }}>Einreichungen</Eyebrow>
      {a.submissions.length > 0 ? (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-1)",
            borderRadius: 18,
            boxShadow: "var(--shadow-card-now)",
            overflow: "hidden",
          }}
        >
          {a.submissions.map((s) => (
            <SubRow key={s.id} s={s} />
          ))}
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-1)",
            borderRadius: 18,
            boxShadow: "var(--shadow-card-now)",
            padding: "34px 22px",
            textAlign: "center",
            fontSize: 13.5,
            color: "var(--text-2)",
          }}
        >
          Noch keine Einreichungen. Sobald Teilnehmende abgeben, erscheinen sie hier.
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-2)", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, color: "var(--text-hi)" }}>{value}</div>
    </div>
  );
}

function SubRow({ s }: { s: SubmissionRow }) {
  const st = STATUS[s.status];
  return (
    <div style={{ display: "grid", gridTemplateColumns: SUB_GRID, gap: 14, alignItems: "center", padding: "12px 22px", borderTop: "1px solid var(--border-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <Avatar name={s.student} size={32} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-hi)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {s.student}
        </span>
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: st.color, background: st.tint, padding: "4px 11px", borderRadius: 999, justifySelf: "start" }}>
        {st.label}
      </span>
      <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{s.submittedAt ? shortDate(s.submittedAt) : "—"}</span>
      <div style={{ justifySelf: "end" }}>
        {s.canGrade && s.gradeHref ? (
          <Link
            href={s.gradeHref}
            className="hover-gruen press"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 32,
              padding: "0 14px",
              borderRadius: 9,
              border: "1px solid var(--border-strong)",
              background: "var(--bg)",
              color: "var(--text-hi)",
              fontSize: 12.5,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Bewerten
          </Link>
        ) : null}
      </div>
    </div>
  );
}
