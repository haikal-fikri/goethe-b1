"use client";
import { useEffect, useState } from "react";
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
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
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
 *
 * Der Rohtext lebt lokal. Würde man bei jedem Tastendruck über
 * split/filter(Boolean)/join zurückrechnen, verschwände die gerade getippte
 * Leerzeile sofort wieder — die Eingabetaste wäre wirkungslos und die Liste
 * ließe sich gar nicht erweitern. Erst beim Verlassen des Feldes wird
 * normalisiert; nach außen gehen immer nur nicht-leere, getrimmte Einträge
 * (bei `tokens` entscheidend: ein leeres Token bricht join(" ") === phrase_de).
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
  const [text, setText] = useState(() => value.join("\n"));
  const [fokus, setFokus] = useState(false);

  // Von außen gesetzte Werte (anderer Datensatz im Formular) übernehmen —
  // aber nicht, während getippt wird.
  const extern = value.join("\n");
  useEffect(() => {
    if (!fokus) setText(extern);
  }, [extern, fokus]);

  const zerlegen = (v: string) =>
    v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  return (
    <TextArea
      value={text}
      onChange={(v) => {
        setText(v);
        onChange(zerlegen(v));
      }}
      onFocus={() => setFokus(true)}
      onBlur={() => {
        setFokus(false);
        const sauber = zerlegen(text);
        setText(sauber.join("\n"));
        onChange(sauber);
      }}
      rows={rows}
      placeholder={placeholder}
      mono
    />
  );
}
