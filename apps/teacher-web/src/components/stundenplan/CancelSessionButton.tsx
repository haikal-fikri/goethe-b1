"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api";
import { CancelSessionModal } from "@/components/stundenplan/CancelSessionModal";

// "Stunde absagen" auf der Anwesenheits-Seite. Absage über die service-role-Route
// (Fan-out), danach zurück zum Stundenplan.

export function CancelSessionButton({
  sessionId,
  sessionLabel,
}: {
  sessionId: string;
  sessionLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm(reason: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await authedFetch(`/api/class/sessions/${sessionId}/cancel`, {
        method: "POST",
        body: JSON.stringify(reason ? { reason } : {}),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(b?.error?.message ?? "Absage fehlgeschlagen.");
      }
      setOpen(false);
      router.push("/stundenplan");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setErr(null);
          setOpen(true);
        }}
        className="press"
        style={{
          height: 40,
          padding: "0 15px",
          borderRadius: 11,
          border: "1px solid var(--border-strong)",
          background: "var(--bg)",
          color: "var(--rot-text)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Stunde absagen
      </button>
      {open ? (
        <CancelSessionModal
          sessionLabel={sessionLabel}
          busy={busy}
          error={err}
          onClose={() => (busy ? undefined : setOpen(false))}
          onConfirm={confirm}
        />
      ) : null}
    </>
  );
}
