import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
} from "react";

// Buttons, Chips, Eingabefelder, Segmented-Control (aus dem Lehrkraft-Portal
// portiert). Presentational — der onClick kommt vom aufrufenden Client-Component.
// Hover/Press/Focus laufen über die globalen Utility-Klassen, nie inline.

type Variant =
  | "primary"
  | "accent"
  | "outline"
  | "ghost"
  | "danger"
  | "dangerSoft";

const BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 42,
  padding: "0 16px",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid transparent",
  whiteSpace: "nowrap",
};

function variantStyle(v: Variant): CSSProperties {
  switch (v) {
    case "primary":
      return {
        background: "var(--primary-btn-bg)",
        color: "var(--primary-btn-fg)",
      };
    case "accent":
      // #fff ist hier korrekt (und die einzige erlaubte Hex-Ausnahme): auf einer
      // gesättigten Akzentfläche darf die Schrift NICHT var(--bg) sein, sonst
      // steht im Dark-Theme fast-schwarze Schrift auf Grün.
      return {
        background: "var(--gruen)",
        color: "#fff",
        boxShadow: "var(--glow-gruen)",
      };
    case "outline":
      return {
        background: "var(--bg)",
        color: "var(--text-hi)",
        borderColor: "var(--border-strong)",
      };
    case "ghost":
      return { background: "transparent", color: "var(--text-1)" };
    case "danger":
      return { background: "var(--rot)", color: "#fff" };
    case "dangerSoft":
      return {
        background: "var(--rot-tint)",
        color: "var(--rot-text)",
        borderColor: "color-mix(in oklab, var(--rot) 30%, transparent)",
      };
  }
}

function variantClass(v: Variant): string {
  switch (v) {
    case "primary":
      return "btn-primary press";
    case "accent":
      return "btn-accent press";
    case "outline":
      return "hover-strong press";
    case "ghost":
      return "hover-surface press";
    default:
      return "press";
  }
}

export function Button({
  variant = "primary",
  style,
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`${variantClass(variant)}${className ? ` ${className}` : ""}`}
      style={{ ...BASE, ...variantStyle(variant), ...style }}
    >
      {children}
    </button>
  );
}

/** Button-Optik als <a>/<Link>-Kind — gleiche Tokens, ohne <button>-Semantik. */
export function buttonStyle(variant: Variant = "primary"): CSSProperties {
  return { ...BASE, ...variantStyle(variant), textDecoration: "none" };
}
export function buttonClass(variant: Variant = "primary"): string {
  return variantClass(variant);
}

export function IconButton({
  style,
  className,
  children,
  size = 40,
  ...rest
}: {
  size?: number;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`hover-strong press${className ? ` ${className}` : ""}`}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: 11,
        border: "1px solid var(--border-1)",
        background: "var(--bg)",
        color: "var(--text-1)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────
   Ein Primitive für die Filter-/Tab-Pillen, die vorher in drei fast
   identischen Kopien lagen (Skill-Tabs, Niveau-Filter, Aufgaben-Tabs).
   Aktiv = invertierte Vollfläche (--primary-btn-bg/-fg) — invertiert im
   Dark-Theme korrekt mit. */
export function Chip({
  active = false,
  size = "md",
  style,
  className,
  children,
  ...rest
}: {
  active?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const sm = size === "sm";
  return (
    <button
      {...rest}
      className={`press${active ? "" : " hover-strong"}${className ? ` ${className}` : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        flexShrink: 0,
        padding: sm ? "5px 11px" : "8px 15px",
        borderRadius: 999,
        fontSize: sm ? 12 : 13.5,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        border: "1px solid",
        borderColor: active ? "var(--primary-btn-bg)" : "var(--border-1)",
        background: active ? "var(--primary-btn-bg)" : "var(--surface-1)",
        color: active ? "var(--primary-btn-fg)" : "var(--text-2)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ── Eingabefelder ────────────────────────────────────────────────────
   Vorher 4× dupliziert (Suche, <select>, E-Mail, Textarea). */
export const INPUT: CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 15,
  border: "1px solid var(--border-1)",
  background: "var(--surface-1)",
  padding: "0 14px",
  fontSize: 14,
  color: "var(--text-hi)",
  outline: "none",
};

export function TextInput({
  style,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`focus-ring${className ? ` ${className}` : ""}`}
      style={{ ...INPUT, ...style }}
    />
  );
}

/** Feld-Label über einem Input — 11/600/.1em/uppercase. */
export function FieldLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "block",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--text-2)",
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
}

/** Segmented control — selektiertes Segment = angehobene Karte. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 3,
        background: "var(--track-2)",
        borderRadius: 11,
        padding: 3,
        ...style,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="press"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "7px 13px",
              borderRadius: 9,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background: active ? "var(--surface-1)" : "transparent",
              color: active ? "var(--text-hi)" : "var(--text-2)",
              boxShadow: active ? "0 1px 3px rgba(28,24,20,.1)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
