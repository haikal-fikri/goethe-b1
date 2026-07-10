"use client";
import { IconSend } from "@/components/icons";
import { statusOf } from "@/components/review/ScoreSummary";

// Bestätigungs-Modal vor der Freigabe. Die Bewertung wird für den/die
// Teilnehmende:n sichtbar und eine Benachrichtigung ausgelöst (Route-Seite).

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

export function FreigebenModal({
  student,
  total,
  max,
  busy,
  onCancel,
  onConfirm,
}: {
  student: string;
  total: number;
  max: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  const status = statusOf(pct);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={busy ? undefined : onCancel} style={{ position: "absolute", inset: 0, background: "rgba(20,17,12,.42)", backdropFilter: "blur(3px)" }} />
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
            background: "var(--gruen-tint)",
            color: "var(--gruen)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <IconSend size={26} />
        </div>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 23, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 8px" }}>
          Bewertung freigeben?
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.6, color: "var(--text-1)" }}>
          Die Bewertung wird für <strong style={{ color: "var(--text-hi)" }}>{student}</strong> in der App sichtbar und die Person wird
          benachrichtigt.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-alt)", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: status.color }}>{pct}%</span>
          <span style={{ fontSize: 13, color: "var(--text-2)" }}>·</span>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: status.color }}>{status.label}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--text-2)" }}>
            {fmt(total)} / {fmt(max)} Punkte
          </span>
        </div>
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
            {busy ? "Freigeben…" : "Jetzt freigeben"}
          </button>
        </div>
      </div>
    </div>
  );
}
