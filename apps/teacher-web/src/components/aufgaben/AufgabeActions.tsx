"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { deleteAssignment } from "@/lib/data/assignments";
import { IconAlertTriangle } from "@/components/icons";

// Detail-Insel: Aufgabe löschen. Client-direkter RLS-Delete über die DAL
// (RLS "assign teacher delete" gatet auf die eigene, entsperrte Klasse). Danach
// zurück zur Liste + refresh. Danger-Confirm-Modal (Muster: FreigebenModal).

export function AufgabeActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await deleteAssignment(supabaseBrowser(), id);
      if (error) throw new Error(error.message);
      router.push("/aufgaben");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Die Aufgabe konnte nicht gelöscht werden.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="press"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          height: 38,
          padding: "0 14px",
          borderRadius: 11,
          border: "1px solid color-mix(in oklab, var(--rot) 30%, transparent)",
          background: "var(--rot-tint)",
          color: "var(--rot-text)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Aufgabe löschen
      </button>

      {open ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div
            onClick={busy ? undefined : () => setOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(20,17,12,.42)", backdropFilter: "blur(3px)" }}
          />
          <div
            style={{
              position: "relative",
              width: 432,
              maxWidth: "100%",
              background: "var(--surface-1)",
              border: "1px solid var(--border-1)",
              borderRadius: 22,
              boxShadow: "var(--shadow-island)",
              padding: 26,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 15,
                background: "var(--rot-tint)",
                color: "var(--rot-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <IconAlertTriangle size={26} />
            </div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 23, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 8px" }}>
              Aufgabe löschen?
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6, color: "var(--text-1)" }}>
              <strong style={{ color: "var(--text-hi)" }}>{title}</strong> wird für alle Teilnehmenden entfernt. Bereits eingereichte
              Abgaben gehen dabei verloren. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            {err ? (
              <div style={{ margin: "0 0 16px", fontSize: 13, color: "var(--rot-text)", background: "var(--rot-tint)", borderRadius: 11, padding: "10px 12px" }}>
                {err}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setOpen(false)}
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
                onClick={confirmDelete}
                disabled={busy}
                className="press"
                style={{
                  flex: 1.3,
                  height: 46,
                  borderRadius: 13,
                  border: "none",
                  background: "var(--rot)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? "Löschen…" : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
