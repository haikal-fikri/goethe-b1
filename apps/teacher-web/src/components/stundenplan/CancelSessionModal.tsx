"use client";
import { useState } from "react";

// Bestätigungs-Modal für die Termin-Absage. Mirror von FreigebenModal (fixes
// Overlay + zentrierte Token-Karte). Die Absage löst serverseitig eine
// Benachrichtigung an die eingeschriebenen Teilnehmenden aus (Route-Fan-out).
// Der Grund ist optional (cancelSchema: ≤500 Zeichen).

function WarnIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function CancelSessionModal({
  sessionLabel,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  sessionLabel: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div
        onClick={busy ? undefined : onClose}
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
          <WarnIcon />
        </div>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 23, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 8px" }}>
          Stunde absagen?
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.6, color: "var(--text-1)" }}>
          <strong style={{ color: "var(--text-hi)" }}>{sessionLabel}</strong> wird als abgesagt markiert. Alle eingeschriebenen
          Teilnehmenden werden benachrichtigt.
        </p>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-2)", marginBottom: 8 }}>
          Grund (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          disabled={busy}
          placeholder="z. B. Krankheit, Feiertag …"
          className="focus-ring"
          style={{
            width: "100%",
            minHeight: 78,
            resize: "vertical",
            borderRadius: 13,
            border: "1px solid var(--border-1)",
            background: "var(--bg)",
            padding: "11px 13px",
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "var(--text-hi)",
            outline: "none",
            marginBottom: error ? 10 : 20,
          }}
        />
        {error ? (
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--rot-text)" }}>{error}</p>
        ) : null}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
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
            Zurück
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
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
            {busy ? "Wird abgesagt…" : "Stunde absagen"}
          </button>
        </div>
      </div>
    </div>
  );
}
