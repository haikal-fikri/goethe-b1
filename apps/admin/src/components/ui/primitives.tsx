import type { CSSProperties, ReactNode } from "react";
import { initials as toInitials, avatarTint } from "@/lib/format";

// Präsentations-Primitives des Lehrkraft-Portals. Rein visuell (kein State) →
// nutzbar in Server- UND Client-Components. Sie lesen ausschließlich semantische
// Tokens; Hover kommt aus den Utility-Klassen in globals.css.

export type Tone = "gruen" | "blau" | "lila" | "gold" | "rot" | "neutral";

const TONE: Record<Tone, { color: string; tint: string }> = {
  gruen: { color: "var(--gruen)", tint: "var(--gruen-tint)" },
  blau: { color: "var(--blau)", tint: "var(--blau-tint)" },
  lila: { color: "var(--lila)", tint: "var(--lila-tint)" },
  gold: { color: "var(--gold-text)", tint: "var(--gold-tint)" },
  rot: { color: "var(--rot-text)", tint: "var(--rot-tint)" },
  neutral: { color: "var(--text-2)", tint: "var(--surface-alt)" },
};

export function toneOf(tone: Tone) {
  return TONE[tone];
}

/* ── Card ─────────────────────────────────────────────────────────── */
export function Card({
  children,
  style,
  radius = 18,
  padded = true,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  radius?: number;
  padded?: boolean;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-1)",
        borderRadius: radius,
        boxShadow: "var(--shadow-card-now)",
        padding: padded ? "20px 22px" : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Eyebrow label ────────────────────────────────────────────────── */
export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "var(--text-2)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Status pill ──────────────────────────────────────────────────── */
export function Pill({
  children,
  tone = "neutral",
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  style?: CSSProperties;
}) {
  const t = TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        fontWeight: 600,
        color: t.color,
        background: t.tint,
        padding: "4px 11px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ── Avatar (Initialen) ───────────────────────────────────────────── */
export function Avatar({
  name,
  size = 34,
  tone,
  style,
}: {
  name: string;
  size?: number;
  tone?: { bg: string; fg: string };
  style?: CSSProperties;
}) {
  const t = tone ?? avatarTint(name);
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.37),
        fontWeight: 600,
        background: t.bg,
        color: t.fg,
        ...style,
      }}
    >
      {toInitials(name)}
    </span>
  );
}

/* ── Progress bar ─────────────────────────────────────────────────── */
export function ProgressBar({
  value,
  color = "var(--gruen)",
  height = 6,
  track = "var(--track-1)",
  style,
}: {
  value: number; // 0–100
  color?: string;
  height?: number;
  track?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        height,
        borderRadius: 999,
        background: track,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(100, value))}%`,
          borderRadius: 999,
          background: color,
          transition: "width .5s var(--ease)",
        }}
      />
    </div>
  );
}
