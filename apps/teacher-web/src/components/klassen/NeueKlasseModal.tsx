"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { classesData } from "@/lib/data";
import { IconPlus } from "@/components/icons";
import { ModalShell, ModalError } from "./ModalShell";

// Neue Klasse anlegen (client-direkt unter RLS: classes teacher insert +
// enforce_class_cap-Trigger). `userId` MUSS = auth.uid() (WITH CHECK). Bei
// erreichtem Plan-Limit meldet der Trigger 'class_limit_reached' → freundlich
// übersetzt. Der Zeitraum (term_start/term_end) ist Pflicht, da die DAL die
// Spalten immer schreibt (leere Datumswerte würde Postgres ablehnen).
export function NeueKlasseModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const nm = name.trim();
    if (!nm) return setErr("Bitte einen Klassennamen eingeben.");
    if (!start || !end) return setErr("Bitte Kursbeginn und Kursende angeben.");
    if (end < start) return setErr("Das Kursende liegt vor dem Kursbeginn.");

    setBusy(true);
    setErr(null);
    const { error } = await classesData.createClass(supabaseBrowser(), userId, {
      name: nm,
      term_start: start,
      term_end: end,
    });
    if (error) {
      setBusy(false);
      setErr(mapError(error.message));
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <ModalShell onClose={onClose} busy={busy} width={468}>
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
          marginBottom: 16,
        }}
      >
        <IconPlus size={26} strokeWidth={2} />
      </div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 23, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 6px" }}>
        Neue Klasse anlegen
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.55, color: "var(--text-2)" }}>
        Ein Beitritts-Code wird automatisch erzeugt. Teilnehmende einladen Sie danach im Klassen-Detail.
      </p>

      {err ? <ModalError message={err} /> : null}

      <Field label="Klassenname">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="z. B. B1 Abendkurs"
          autoFocus
          style={inputStyle}
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Kursbeginn">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Kursende">
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <button onClick={onClose} disabled={busy} className="hover-strong press" style={cancelBtn(busy)}>
          Abbrechen
        </button>
        <button onClick={submit} disabled={busy} className="btn-accent press" style={confirmBtn(busy)}>
          {busy ? "Anlegen…" : "Klasse anlegen"}
        </button>
      </div>
    </ModalShell>
  );
}

function mapError(msg: string): string {
  if (/class_limit_reached|plan cap|limit/i.test(msg)) {
    return "Plan-Limit erreicht: Ihr Tarif erlaubt keine weitere aktive Klasse. Bitte upgraden Sie auf Pro.";
  }
  return msg || "Die Klasse konnte nicht angelegt werden.";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-2)", marginBottom: 7 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "1px solid var(--border-strong)",
  background: "var(--bg)",
  color: "var(--text-hi)",
  fontSize: 14,
  padding: "0 13px",
  outline: "none",
};

function cancelBtn(busy: boolean): CSSProperties {
  return {
    flex: 1,
    height: 46,
    borderRadius: 13,
    border: "1px solid var(--border-strong)",
    background: "var(--bg)",
    color: "var(--text-hi)",
    fontSize: 14,
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
  };
}

function confirmBtn(busy: boolean): CSSProperties {
  return {
    flex: 1.4,
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
  };
}
