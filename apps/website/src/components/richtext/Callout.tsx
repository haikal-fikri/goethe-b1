import { InfoIcon } from "../icons";

/**
 * Hinweiskasten der Dokumentation. „note" ist der grüne Kasten aus dem Design,
 * „warning" dieselbe Form in Gold.
 */
export function Callout({
  variant = "note",
  content,
}: {
  variant?: "note" | "warning";
  content: string;
}) {
  const accent = variant === "warning" ? "var(--gold)" : "var(--gruen)";
  const tint = variant === "warning" ? "var(--gold-tint)" : "var(--gruen-tint)";

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        background: tint,
        border: `1px solid ${accent}`,
        borderRadius: 16,
        padding: "18px 20px",
        margin: "26px 0",
      }}
    >
      <span style={{ color: accent, flex: "0 0 18px", marginTop: 2 }}>
        <InfoIcon />
      </span>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "var(--text-1)" }}>{content}</p>
    </div>
  );
}
