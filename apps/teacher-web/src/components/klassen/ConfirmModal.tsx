"use client";
import type { ReactNode } from "react";
import { IconAlertTriangle } from "@/components/icons";
import { ModalShell, ModalError } from "./ModalShell";

// Bestätigungs-Dialog für abbauende/zerstörende Aktionen (Teilnehmende:n
// entfernen, Klasse archivieren/löschen). Ton über `danger`.
export function ConfirmModal({
  title,
  body,
  confirmLabel,
  danger = false,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const accent = danger ? "var(--rot)" : "var(--gruen)";
  const tint = danger ? "var(--rot-tint)" : "var(--gruen-tint)";
  const iconColor = danger ? "var(--rot-text)" : "var(--gruen)";
  return (
    <ModalShell onClose={onCancel} busy={busy} width={432}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 15,
          background: tint,
          color: iconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <IconAlertTriangle size={26} />
      </div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 8px" }}>
        {title}
      </h2>
      <div style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.6, color: "var(--text-1)" }}>{body}</div>

      {error ? <ModalError message={error} /> : null}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel}
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
          onClick={onConfirm}
          disabled={busy}
          className="press"
          style={{
            flex: 1.3,
            height: 46,
            borderRadius: 13,
            border: "none",
            background: accent,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Bitte warten…" : confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
