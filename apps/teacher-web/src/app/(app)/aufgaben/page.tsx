import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getAssignmentList, type AssignmentListItem } from "@/lib/aufgaben";
import { Eyebrow, SkillTile } from "@/components/ui/primitives";
import { IconPlus, IconPencil, IconMic, IconChevronRight, IconClipboardCheck } from "@/components/icons";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const GRID = "1.9fr 1.2fr 1fr 1.3fr 1fr 40px";

export default async function AufgabenPage() {
  await requireAuth("/aufgaben");
  const sb = await supabaseServer();
  const { hasClasses, items } = await getAssignmentList(sb);

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "30px 34px 60px" }}>
      {/* Kopf */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 24 }}>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Aufgaben</Eyebrow>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600, color: "var(--text-hi)", margin: 0, letterSpacing: "-.01em" }}>
            Aufgaben
          </h1>
        </div>
        <Link
          href="/aufgaben/neu"
          className="btn-primary press"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 44,
            padding: "0 17px",
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

      {items.length > 0 ? (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-1)",
            borderRadius: 18,
            boxShadow: "var(--shadow-card-now)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 14, padding: "13px 22px", borderBottom: "1px solid var(--border-1)" }}>
            <HeadCell>Aufgabe</HeadCell>
            <HeadCell>Klasse</HeadCell>
            <HeadCell>Fällig</HeadCell>
            <HeadCell>Einreichungen</HeadCell>
            <HeadCell>Zu bewerten</HeadCell>
            <span />
          </div>
          {items.map((a) => (
            <Row key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <EmptyCard hasClasses={hasClasses} />
      )}
    </div>
  );
}

function HeadCell({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--text-2)" }}>
      {children}
    </span>
  );
}

function Row({ a }: { a: AssignmentListItem }) {
  const pct = a.enrolled > 0 ? Math.round((a.submitted / a.enrolled) * 100) : 0;
  return (
    <Link
      href={`/aufgaben/${a.id}`}
      className="hover-surface"
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        gap: 14,
        alignItems: "center",
        padding: "13px 22px",
        borderTop: "1px solid var(--border-1)",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <SkillTile skill={a.skill} size={30} radius={9}>
          {a.skill === "schreiben" ? <IconPencil size={16} /> : <IconMic size={16} />}
        </SkillTile>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-hi)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.title}
        </span>
      </div>
      <span style={{ fontSize: 13, color: "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.klasse}</span>
      <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{a.dueAt ? shortDate(a.dueAt) : "—"}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ flex: 1, maxWidth: 80, height: 6, borderRadius: 999, background: "var(--track-1)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: "var(--gruen)" }} />
        </div>
        <span style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
          <span style={{ fontFamily: "var(--font-serif)", color: "var(--text-hi)" }}>{a.submitted}</span>/{a.enrolled}
        </span>
      </div>
      <div>
        {a.toGrade > 0 ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gruen)", background: "var(--gruen-tint)", padding: "4px 10px", borderRadius: 999 }}>
            {a.toGrade}
          </span>
        ) : null}
      </div>
      <IconChevronRight size={16} style={{ color: "var(--text-3)" }} />
    </Link>
  );
}

function EmptyCard({ hasClasses }: { hasClasses: boolean }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-1)",
        borderRadius: 20,
        boxShadow: "var(--shadow-card-now)",
        padding: "48px 32px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 15,
          background: "var(--gruen-tint)",
          color: "var(--gruen)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
      >
        <IconClipboardCheck size={26} />
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600, color: "var(--text-hi)", marginBottom: 8 }}>
        {hasClasses ? "Noch keine Aufgaben" : "Zuerst eine Klasse anlegen"}
      </div>
      <p style={{ margin: "0 auto 20px", maxWidth: 440, fontSize: 14, lineHeight: 1.6, color: "var(--text-2)" }}>
        {hasClasses
          ? "Erstellen Sie eine Schreib- oder Sprechaufgabe und weisen Sie sie einer Klasse zu."
          : "Aufgaben werden Klassen zugewiesen. Legen Sie zuerst eine Klasse an, dann können Sie Aufgaben erstellen."}
      </p>
      <Link
        href={hasClasses ? "/aufgaben/neu" : "/klassen"}
        className="btn-accent press"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 44,
          padding: "0 18px",
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
        <IconPlus size={17} />
        {hasClasses ? "Neue Aufgabe" : "Zu den Klassen"}
      </Link>
    </div>
  );
}
