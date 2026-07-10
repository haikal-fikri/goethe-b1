import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

// Buttons + Segmented-Control. Presentational (kein State) — der onClick kommt
// vom aufrufenden Client-Component. Hover/Press über globale Utility-Klassen.

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger" | "dangerSoft";

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
      return { background: "var(--primary-btn-bg)", color: "var(--primary-btn-fg)" };
    case "accent":
      return { background: "var(--gruen)", color: "#fff", boxShadow: "var(--glow-gruen)" };
    case "outline":
      return { background: "var(--bg)", color: "var(--text-hi)", borderColor: "var(--border-strong)" };
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

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
}

/** Segmented control — selektiertes Segment = angehobene weiße Karte. */
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
