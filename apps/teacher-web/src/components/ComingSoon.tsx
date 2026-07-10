import { Eyebrow } from "@/components/ui/primitives";

// Platzhalter für Portal-Ansichten, die in der nächsten Ausbau-Phase entstehen.
// Hält die Navigation vollständig begehbar, ohne 404.
export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "30px 34px 60px" }}>
      <Eyebrow style={{ marginBottom: 8 }}>{title}</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 24px" }}>
        {title}
      </h1>
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-1)",
          borderRadius: 20,
          boxShadow: "var(--shadow-card-now)",
          padding: "48px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600, color: "var(--text-hi)", marginBottom: 8 }}>
          Diese Ansicht folgt in Kürze
        </div>
        <p style={{ margin: "0 auto", maxWidth: 460, fontSize: 14, lineHeight: 1.6, color: "var(--text-2)" }}>
          {note ??
            "Dashboard und der Bewertungs-Flow (Schreiben & Sprechen) sind fertig. Diese Ansicht wird als Nächstes aus demselben Design-System gebaut."}
        </p>
      </div>
    </div>
  );
}
