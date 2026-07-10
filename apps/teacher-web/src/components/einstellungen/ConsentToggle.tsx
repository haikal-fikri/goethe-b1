"use client";
import { useState } from "react";
import { authedFetch } from "@/lib/api";
import { Avatar, Pill } from "@/components/ui/primitives";

export type ConsentStatus = "granted" | "withdrawn" | "none";

// Eine Zeile der Einwilligungs-Liste (Sprechen/Audio). Die Lehrkraft erfasst die
// Erziehungsberechtigten-Einwilligung im Namen der/des Teilnehmenden (Papierbeleg)
// über POST /api/consent — die Route verlangt Lehrer-Rolle + app_teacher_can_read.
// guardian_consents ist ausschließlich service-role-beschreibbar.
export function ConsentToggle({
  studentId,
  name,
  status: initial,
  divider,
}: {
  studentId: string;
  name: string;
  status: ConsentStatus;
  divider: boolean;
}) {
  const [status, setStatus] = useState<ConsentStatus>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const granted = status === "granted";

  async function record(next: "granted" | "withdrawn") {
    setBusy(true);
    setErr(null);
    try {
      const res = await authedFetch("/api/consent", {
        method: "POST",
        body: JSON.stringify({ studentId, status: next, method: "paper" }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(b?.error?.message ?? "Einwilligung konnte nicht aktualisiert werden.");
      }
      setStatus(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  const pill =
    status === "granted"
      ? { tone: "gruen" as const, label: "erteilt" }
      : status === "withdrawn"
      ? { tone: "rot" as const, label: "widerrufen" }
      : { tone: "gold" as const, label: "ausstehend" };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "11px 22px",
        borderTop: divider ? "1px solid var(--border-1)" : "none",
      }}
    >
      <Avatar name={name} size={32} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--text-hi)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </span>
      {err ? <span style={{ fontSize: 11.5, color: "var(--rot-text)" }}>{err}</span> : null}
      <Pill tone={pill.tone}>{pill.label}</Pill>
      <button
        onClick={() => record(granted ? "withdrawn" : "granted")}
        disabled={busy}
        className="press hover-strong"
        style={{
          flex: "0 0 auto",
          height: 30,
          padding: "0 12px",
          borderRadius: 9,
          border: "1px solid var(--border-strong)",
          background: "var(--bg)",
          color: granted ? "var(--rot-text)" : "var(--text-hi)",
          fontSize: 12,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "…" : granted ? "Widerrufen" : "Erfassen"}
      </button>
    </div>
  );
}
