"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QueueItem } from "@/lib/dashboard";
import { Avatar, SkillTile } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/controls";
import { IconPencil, IconMic, IconArrowRight } from "@/components/icons";
import { relativeDe } from "@/lib/format";

type Filter = "alle" | "schreiben" | "sprechen";

export function GradingQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("alle");
  const rows = items.filter((q) => filter === "alle" || q.skill === filter);

  const open = (q: QueueItem) => router.push(`/bewerten/${q.skill}/${q.submissionId}`);

  const GRID = "1.5fr 1fr 1.7fr 0.9fr 128px";

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-1)",
        borderRadius: 20,
        boxShadow: "var(--shadow-card-now)",
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "18px 22px 15px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600, color: "var(--text-hi)", margin: 0 }}>
            Zu bewerten
          </h2>
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--gruen)",
              background: "var(--gruen-tint)",
              minWidth: 26,
              height: 26,
              padding: "0 7px",
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {items.length}
          </span>
        </div>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "alle", label: "Alle" },
            { value: "schreiben", label: "Schreiben" },
            { value: "sprechen", label: "Sprechen" },
          ]}
        />
      </div>

      {rows.length > 0 ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "0 22px 8px", gap: 14 }}>
            {["Teilnehmende:r", "Klasse", "Aufgabe", "Eingereicht", ""].map((h, i) => (
              <span key={i} style={colHead}>
                {h}
              </span>
            ))}
          </div>
          {rows.map((q) => (
            <div
              key={q.submissionId}
              onClick={() => open(q)}
              className="hover-surface"
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 14,
                alignItems: "center",
                padding: "12px 22px",
                borderTop: "1px solid var(--border-1)",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <Avatar name={q.student} size={34} />
                <span style={ellipsis(600, "var(--text-hi)")}>{q.student}</span>
              </div>
              <span style={ellipsis(400, "var(--text-1)", 13)}>{q.klasse}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <SkillTile skill={q.skill} size={28} radius={8}>
                  {q.skill === "schreiben" ? <IconPencil size={15} /> : <IconMic size={15} />}
                </SkillTile>
                <span style={ellipsis(400, "var(--text-hi)", 13.5)}>{q.aufgabe}</span>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--text-2)", whiteSpace: "nowrap" }}>{relativeDe(q.when)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  open(q);
                }}
                className="hover-gruen press"
                style={{
                  height: 34,
                  borderRadius: 9,
                  border: "1px solid var(--border-strong)",
                  background: "var(--bg)",
                  color: "var(--text-hi)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                Bewerten
                <IconArrowRight size={14} />
              </button>
            </div>
          ))}
        </>
      ) : (
        <div style={{ padding: "34px 22px", textAlign: "center", borderTop: "1px solid var(--border-1)" }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-hi)", marginBottom: 4 }}>
            {items.length === 0 ? "Alles bewertet." : "Nichts in diesem Filter."}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)" }}>
            {items.length === 0
              ? "Neu eingereichte Arbeiten erscheinen hier zur Bewertung."
              : "Wechseln Sie den Filter, um weitere Einreichungen zu sehen."}
          </div>
        </div>
      )}
    </div>
  );
}

const colHead: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: ".09em",
  textTransform: "uppercase",
  color: "var(--text-2)",
};
function ellipsis(weight: number, color: string, size = 14): React.CSSProperties {
  return {
    fontSize: size,
    fontWeight: weight,
    color,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}
