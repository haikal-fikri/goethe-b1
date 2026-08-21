"use client";
import type { CSSProperties, ReactNode } from "react";

// Formular-Bausteine der Konsole. Bewusst „controlled" mit einem simplen
// (value, onChange)-Vertrag statt roher DOM-Events — die Editor-Formulare
// binden sehr viele Felder, und das hält die Aufrufstellen kurz.

const baseInput: CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid var(--border-1)",
  background: "var(--bg)",
  padding: "0 12px",
  height: 40,
  fontSize: 13.5,
  fontFamily: "inherit",
  color: "var(--text-hi)",
  outline: "none",
};

export function Field({
  label,
  hint,
  required,
  children,
  style,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, ...style }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }}>
        {label}
        {required ? <span style={{ color: "var(--rot-text)" }}> *</span> : null}
      </span>
      {children}
      {hint ? <span style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.45 }}>{hint}</span> : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="focus-ring"
      style={{
        ...baseInput,
        ...(mono ? { fontFamily: "var(--font-mono)" } : null),
        ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : null),
      }}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="focus-ring"
      style={{
        ...baseInput,
        height: "auto",
        padding: "10px 12px",
        lineHeight: 1.5,
        resize: "vertical",
        ...(mono ? { fontFamily: "var(--font-mono)" } : null),
      }}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      className="focus-ring"
      style={{ ...baseInput, fontFamily: "var(--font-serif)" }}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="focus-ring"
      style={{
        ...baseInput,
        cursor: disabled ? "not-allowed" : "pointer",
        ...(disabled ? { opacity: 0.6 } : null),
      }}
    >
      <option value="">— bitte wählen —</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/**
 * Listenfeld: eine Zeile = ein Eintrag. Deckt tokens/distractors/tags ab.
 * Leere Zeilen fallen raus — bei `tokens` ist das wichtig, weil ein leeres
 * Token die Wortbank-Invariante (join(" ") === phrase_de) sonst bricht.
 */
export function ListInput({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <TextArea
      value={value.join("\n")}
      onChange={(v) =>
        onChange(
          v
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        )
      }
      rows={rows}
      placeholder={placeholder}
      mono
    />
  );
}
