"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { scheduleData } from "@/lib/data";

// Ad-hoc-Einzeltermin anlegen (client-direkt unter RLS, "session teacher all").
// Trigger + Modal in einem Island. `variant="dashed"` = gestrichelte Affordance
// je Klasse (Klasse vorgewählt); "primary" = Kopf-Button (Klassenwahl im Modal).
// createAdHocSession verlangt starts_at/ends_at als ISO — hier aus Datum + Zeit +
// Dauer (lokale Wanduhr → toISOString) berechnet.

function PlusIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--text-2)",
  marginBottom: 7,
};
const fieldStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "1px solid var(--border-1)",
  background: "var(--bg)",
  padding: "0 13px",
  fontSize: 14,
  color: "var(--text-hi)",
  outline: "none",
};

export function NewSessionButton({
  classes,
  preselectClassId,
  variant = "primary",
  label = "Neue Stunde",
}: {
  classes: Array<{ id: string; name: string }>;
  preselectClassId?: string;
  variant?: "primary" | "dashed";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [classId, setClassId] = useState(preselectClassId ?? classes[0]?.id ?? "");
  const today = new Date();
  const [date, setDate] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  );
  const [time, setTime] = useState("18:30");
  const [duration, setDuration] = useState(90);
  const [title, setTitle] = useState("");

  function reset() {
    setClassId(preselectClassId ?? classes[0]?.id ?? "");
    setTime("18:30");
    setDuration(90);
    setTitle("");
    setErr(null);
  }

  async function submit() {
    if (!classId) {
      setErr("Bitte eine Klasse wählen.");
      return;
    }
    const start = new Date(`${date}T${time}`);
    if (Number.isNaN(start.getTime())) {
      setErr("Ungültiges Datum oder Uhrzeit.");
      return;
    }
    const end = new Date(start.getTime() + duration * 60000);
    setBusy(true);
    setErr(null);
    try {
      const { error } = await scheduleData.createAdHocSession(supabaseBrowser(), {
        class_id: classId,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        title: title.trim() || null,
      });
      if (error) throw new Error(error.message);
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  const trigger =
    variant === "dashed" ? (
      <button
        onClick={() => setOpen(true)}
        className="press"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 14px",
          border: "1px dashed var(--border-strong)",
          borderRadius: 12,
          background: "transparent",
          color: "var(--text-2)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          width: "100%",
          justifyContent: "center",
        }}
      >
        <PlusIcon size={16} />
        {label}
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
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
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <PlusIcon />
        {label}
      </button>
    );

  return (
    <>
      {trigger}
      {open ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div
            onClick={() => (busy ? undefined : setOpen(false))}
            style={{ position: "absolute", inset: 0, background: "rgba(20,17,12,.42)", backdropFilter: "blur(3px)" }}
          />
          <div
            style={{
              position: "relative",
              width: 452,
              maxWidth: "100%",
              background: "var(--surface-1)",
              border: "1px solid var(--border-1)",
              borderRadius: 22,
              boxShadow: "var(--shadow-island)",
              padding: 26,
            }}
          >
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 23, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 4px" }}>
              Neue Stunde
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)" }}>
              Einzeltermin außerhalb des wiederkehrenden Wochenplans anlegen.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div>
                <label style={labelStyle}>Klasse</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  disabled={busy || Boolean(preselectClassId)}
                  className="focus-ring"
                  style={{ ...fieldStyle, appearance: "none", cursor: preselectClassId ? "default" : "pointer" }}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Datum</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} className="focus-ring" style={fieldStyle} />
                </div>
                <div style={{ width: 120 }}>
                  <label style={labelStyle}>Uhrzeit</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={busy} className="focus-ring" style={fieldStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 140 }}>
                  <label style={labelStyle}>Dauer (Min)</label>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    disabled={busy}
                    className="focus-ring"
                    style={fieldStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Titel / Ort (optional)</label>
                  <input
                    type="text"
                    value={title}
                    maxLength={160}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={busy}
                    placeholder="z. B. Raum 204"
                    className="focus-ring"
                    style={fieldStyle}
                  />
                </div>
              </div>
            </div>

            {err ? <p style={{ margin: "16px 0 0", fontSize: 13, color: "var(--rot-text)" }}>{err}</p> : null}

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                onClick={() => (busy ? undefined : setOpen(false))}
                disabled={busy}
                className="hover-strong press"
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 13,
                  border: "1px solid var(--border-strong)",
                  background: "var(--bg)",
                  color: "var(--text-hi)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="btn-accent press"
                style={{
                  flex: 1.3,
                  height: 46,
                  borderRadius: 13,
                  border: "none",
                  background: "var(--gruen)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                  boxShadow: "var(--glow-gruen)",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? "Wird angelegt…" : "Stunde anlegen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
