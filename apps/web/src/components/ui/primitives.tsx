import type { CSSProperties, ReactNode } from "react";

// Präsentations-Primitives (aus dem Lehrkraft-Portal portiert). Rein visuell
// (kein State) → nutzbar in Server- UND Client-Components. Sie lesen
// ausschließlich semantische Tokens; Hover kommt aus den Utility-Klassen in
// globals.css. Kein Avatar hier — die öffentliche App kennt keine Nutzer.

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

/* ── Zahlen ───────────────────────────────────────────────────────────
   Designregel des Systems: ALLE Zahlen stehen in der Serifenschrift
   (Punkte, Preise, Zähler, Timer) — nie in der UI- oder Mono-Schrift. */
export function Num({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-serif tabular-nums ${className}`.trim()}>
      {children}
    </span>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────── */
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
        boxShadow: "var(--shadow-card)",
        padding: padded ? "20px 22px" : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Eyebrow (Kicker über Überschriften/Abschnitten) ──────────────────── */
export function Eyebrow({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
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

/* ── Status-Pille ─────────────────────────────────────────────────────── */
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

/* ── Fortschrittsbalken ───────────────────────────────────────────────── */
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

/* ── Skill-Kachel ─────────────────────────────────────────────────────
   Im LMS auf schreiben|sprechen fixiert; hier auf `Tone` geweitet, weil die
   öffentliche App einen dritten Skill kennt (Konnektoren → lila). */
export function SkillTile({
  children,
  tone,
  size = 34,
  radius = 9,
  style,
}: {
  children: ReactNode;
  tone: Tone;
  size?: number;
  radius?: number;
  style?: CSSProperties;
}) {
  const t = TONE[tone];
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: radius,
        background: t.tint,
        color: t.color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
