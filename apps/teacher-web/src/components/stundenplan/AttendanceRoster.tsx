"use client";
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { scheduleData } from "@/lib/data";
import type { AttendanceStatus } from "@/lib/data/schedule";
import type { RosterEntry } from "@/lib/stundenplan";
import { Avatar } from "@/components/ui/primitives";

// Anwesenheits-Erfassung: je Teilnehmende:r eine Status-Auswahl + optionale
// Notiz. Jede Änderung upsertet client-direkt (RLS "attend teacher all",
// marked_by = auth.uid()). Optimistisch: UI sofort, bei Fehler Revert.

const OPTS: Array<{ value: AttendanceStatus; label: string; color: string }> = [
  { value: "present", label: "Anwesend", color: "var(--gruen)" },
  { value: "late", label: "Verspätet", color: "var(--gold-text)" },
  { value: "excused", label: "Entschuldigt", color: "var(--blau)" },
  { value: "absent", label: "Abwesend", color: "var(--rot-text)" },
];
interface LocalRow {
  studentId: string;
  name: string;
  status: AttendanceStatus | null;
  note: string;
}

export function AttendanceRoster({
  sessionId,
  markedBy,
  roster,
}: {
  sessionId: string;
  markedBy: string;
  roster: RosterEntry[];
}) {
  const [rows, setRows] = useState<LocalRow[]>(() =>
    roster.map((r) => ({ studentId: r.studentId, name: r.name, status: r.status, note: r.note ?? "" }))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, excused: 0, absent: 0, offen: 0 };
    for (const r of rows) {
      if (r.status) c[r.status] += 1;
      else c.offen += 1;
    }
    return c;
  }, [rows]);

  async function persist(id: string, status: AttendanceStatus, note: string): Promise<boolean> {
    setSavingId(id);
    setErr(null);
    const { error } = await scheduleData.markAttendance(supabaseBrowser(), markedBy, {
      session_id: sessionId,
      student_id: id,
      status,
      note: note.trim() || null,
    });
    setSavingId(null);
    if (error) {
      setErr(error.message ?? "Speichern fehlgeschlagen.");
      return false;
    }
    return true;
  }

  function setStatus(id: string, next: AttendanceStatus) {
    // Nur die betroffene Zeile optimistisch ändern und bei Fehler NUR diese Zeile
    // zurücksetzen — ein Voll-Array-Snapshot würde parallele Bearbeitungen
    // anderer Teilnehmender überschreiben (mehrere Speichervorgänge sind offen).
    const prevStatus = rows.find((r) => r.studentId === id)?.status ?? null;
    const note = rows.find((r) => r.studentId === id)?.note ?? "";
    setRows((rs) => rs.map((r) => (r.studentId === id ? { ...r, status: next } : r)));
    void persist(id, next, note).then((okr) => {
      if (!okr) setRows((rs) => rs.map((r) => (r.studentId === id ? { ...r, status: prevStatus } : r)));
    });
  }

  function setNote(id: string, val: string) {
    setRows((rs) => rs.map((r) => (r.studentId === id ? { ...r, note: val } : r)));
  }

  function commitNote(id: string) {
    const r = rows.find((x) => x.studentId === id);
    if (r?.status) void persist(id, r.status, r.note);
  }

  if (rows.length === 0) {
    return (
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-1)",
          borderRadius: 18,
          boxShadow: "var(--shadow-card-now)",
          padding: "40px 24px",
          textAlign: "center",
          fontSize: 14,
          color: "var(--text-2)",
        }}
      >
        Noch keine Teilnehmenden in dieser Klasse.
      </div>
    );
  }

  return (
    <div>
      {/* Zusammenfassung */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Count label="anwesend" n={counts.present} color="var(--gruen)" />
        <Count label="verspätet" n={counts.late} color="var(--gold-text)" />
        <Count label="entschuldigt" n={counts.excused} color="var(--blau)" />
        <Count label="abwesend" n={counts.absent} color="var(--rot-text)" />
        <Count label="offen" n={counts.offen} color="var(--text-2)" />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: savingId ? "var(--text-hi)" : "var(--text-3)" }}>
          {savingId ? "Speichern…" : "Automatisch gespeichert"}
        </span>
      </div>

      {err ? (
        <div style={{ marginBottom: 12, padding: "9px 13px", background: "var(--rot-tint)", color: "var(--rot-text)", borderRadius: 11, fontSize: 13 }}>
          {err}
        </div>
      ) : null}

      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-1)",
          borderRadius: 18,
          boxShadow: "var(--shadow-card-now)",
          overflow: "hidden",
        }}
      >
        {rows.map((r, i) => (
          <div
            key={r.studentId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 22px",
              borderTop: i === 0 ? "none" : "1px solid var(--border-1)",
            }}
          >
            <Avatar name={r.name} size={34} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--text-hi)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.name}
            </span>
            <input
              type="text"
              value={r.note}
              maxLength={280}
              onChange={(e) => setNote(r.studentId, e.target.value)}
              onBlur={() => commitNote(r.studentId)}
              placeholder="Notiz"
              className="focus-ring"
              style={{
                width: 168,
                flex: "0 0 168px",
                height: 34,
                borderRadius: 9,
                border: "1px solid var(--border-1)",
                background: "var(--bg)",
                padding: "0 11px",
                fontSize: 12.5,
                color: "var(--text-hi)",
                outline: "none",
              }}
            />
            <div style={{ display: "inline-flex", gap: 2, background: "var(--track-2)", borderRadius: 11, padding: 3 }}>
              {OPTS.map((o) => {
                const active = r.status === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setStatus(r.studentId, o.value)}
                    className="press"
                    style={{
                      padding: "7px 11px",
                      borderRadius: 9,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      background: active ? "var(--surface-1)" : "transparent",
                      color: active ? o.color : "var(--text-2)",
                      boxShadow: active ? "0 1px 3px rgba(28,24,20,.12)" : "none",
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Count({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, fontSize: 12.5, color: "var(--text-2)" }}>
      <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600, color }}>{n}</span>
      {label}
    </span>
  );
}
