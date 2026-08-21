"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api";
import type { ResourceConfig, ResourceField } from "@/lib/korpus";
import { Card, Pill } from "@/components/ui/primitives";
import { Button } from "@/components/ui/controls";
import { Field, TextInput, TextArea, NumberInput, Select, ListInput } from "@/components/ui/form";
import { ModalShell, ModalError } from "@/components/ui/ModalShell";
import { IconPlus, IconPencil } from "@/components/icons";

// Ein Formular für alle Korpus-Ressourcen, gesteuert über die Feld-Deskriptoren
// aus lib/korpus.ts. Die Comp entwirft für diese Tabellen keine eigenen
// Screens — hier zählt Korrektheit (richtige Feldnamen, PKs unveränderlich)
// mehr als Gestaltung.
//
// Die Validierung ist serverseitig maßgeblich (zod in @repo/core); dieses
// Formular hält nur offensichtliche Fehler ab und zeigt die Servermeldung an.

type Werte = Record<string, string | number | string[]>;

function leereWerte(fields: ResourceField[]): Werte {
  const w: Werte = {};
  for (const f of fields) {
    w[f.name] = f.type === "list" ? [] : f.type === "number" ? 0 : "";
  }
  return w;
}

/** Nur gefüllte Felder senden — leere Optionale würden Spalten überschreiben. */
function payload(fields: ResourceField[], werte: Werte, nurPk = false): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = werte[f.name];
    if (nurPk && !f.pk) continue;
    if (Array.isArray(v)) {
      if (v.length > 0 || f.required) out[f.name] = v;
    } else if (typeof v === "number") {
      if (v !== 0 || f.required) out[f.name] = v;
    } else if (typeof v === "string" && v.trim() !== "") {
      out[f.name] = v.trim();
    }
  }
  return out;
}

export function ResourceBrowser({
  cfg,
  rows,
  total,
}: {
  cfg: ResourceConfig;
  rows: Array<Record<string, unknown>>;
  total: number | null;
}) {
  const router = useRouter();
  const [modus, setModus] = useState<"zu" | "neu" | "bearbeiten">("zu");
  const [werte, setWerte] = useState<Werte>(() => leereWerte(cfg.fields));
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);

  function oeffneNeu() {
    setWerte(leereWerte(cfg.fields));
    setFehler(null);
    setModus("neu");
  }

  function oeffneBearbeiten(row: Record<string, unknown>) {
    // Vollständig vorbefüllen (die Query liest dafür auch die Formularspalten).
    // Wichtig für redemittel: phraseDe und tokens müssen GEMEINSAM gesendet
    // werden, sonst lehnt der Server ab — mit halbem Formular wäre die Zeile
    // über die Oberfläche nicht änderbar.
    const w = leereWerte(cfg.fields);
    for (const f of cfg.fields) {
      const v = row[f.col];
      if (v === null || v === undefined) continue;
      if (f.type === "list") w[f.name] = Array.isArray(v) ? v.map(String) : [];
      else if (f.type === "number") w[f.name] = Number(v) || 0;
      else w[f.name] = String(v);
    }
    setWerte(w);
    setFehler(null);
    setModus("bearbeiten");
  }

  async function speichern() {
    setBusy(true);
    setFehler(null);
    try {
      const body = payload(cfg.fields, werte);
      const res = await authedFetch(`/api/admin/corpus/${cfg.slug}`, {
        method: modus === "neu" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as
        | { id?: string; error?: { message?: string } }
        | null;
      if (!res.ok) {
        setFehler(data?.error?.message ?? "Speichern fehlgeschlagen.");
        return;
      }
      setModus("zu");
      setErfolg(modus === "neu" ? `Angelegt: ${data?.id ?? ""}` : `Gespeichert: ${data?.id ?? ""}`);
      router.refresh();
    } catch {
      setFehler("Verbindung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  const pflichtErfuellt = cfg.fields
    .filter((f) => f.required)
    .every((f) => {
      const v = werte[f.name];
      return Array.isArray(v) ? v.length > 0 : String(v ?? "").trim() !== "";
    });

  const cols = cfg.listColumns.map(() => "1fr").join(" ") + " 90px";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text-2)" }}>
          {total === null ? "—" : total} {total === 1 ? "Eintrag" : "Einträge"}
          {total !== null && rows.length < total ? ` · zeigt die ersten ${rows.length}` : ""}
        </span>
        <span style={{ flex: 1 }} />
        {erfolg ? <Pill tone="gruen">{erfolg}</Pill> : null}
        <Button variant="accent" onClick={oeffneNeu} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconPlus size={16} strokeWidth={2} />
          Neu
        </Button>
      </div>

      <Card radius={18} padded={false} style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            gap: 12,
            padding: "13px 20px",
            borderBottom: "1px solid var(--border-1)",
          }}
        >
          {cfg.listColumns.map((c) => (
            <span
              key={c.col}
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: ".09em",
                textTransform: "uppercase",
                color: "var(--text-2)",
              }}
            >
              {c.label}
            </span>
          ))}
          <span />
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "18px 20px", fontSize: 13, color: "var(--text-2)" }}>
            Keine Einträge.
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                gap: 12,
                alignItems: "center",
                padding: "11px 20px",
                borderTop: "1px solid var(--border-1)",
              }}
            >
              {cfg.listColumns.map((c) => (
                <span
                  key={c.col}
                  title={String(r[c.col] ?? "")}
                  style={{
                    fontSize: 13,
                    color: "var(--text-hi)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    ...(c.col === "id" || c.col === "code" || c.col === "row_id"
                      ? { fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-2)" }
                      : null),
                  }}
                >
                  {String(r[c.col] ?? "—")}
                </span>
              ))}
              <Button
                variant="ghost"
                onClick={() => oeffneBearbeiten(r)}
                style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px" }}
              >
                <IconPencil size={14} />
                Ändern
              </Button>
            </div>
          ))
        )}
      </Card>

      {modus !== "zu" ? (
        <ModalShell onClose={() => setModus("zu")} busy={busy} width={620}>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              fontWeight: 600,
              color: "var(--text-hi)",
              margin: "0 0 6px",
            }}
          >
            {modus === "neu" ? `${cfg.titel}: neuer Eintrag` : `${cfg.titel} bearbeiten`}
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: 12.5, lineHeight: 1.55, color: "var(--text-2)" }}>
            {modus === "bearbeiten"
              ? "Leer gelassene Felder bleiben unverändert. Der Schlüssel ist nicht änderbar."
              : "Pflichtfelder sind mit * markiert."}
          </p>

          {/* Viele Felder (Redemittel hat 17) — der Rumpf scrollt, Titel und
              Aktionen bleiben stehen. */}
          <div className="lms-scroll" style={{ maxHeight: "56vh", overflowY: "auto", paddingRight: 4 }}>
            {cfg.fields.map((f) => (
              <Field key={f.name} label={f.label} hint={f.hint} required={f.required}>
                {renderInput(f, werte, setWerte, modus === "bearbeiten" && Boolean(f.pk))}
              </Field>
            ))}
          </div>

          {fehler ? <div style={{ marginTop: 14 }}><ModalError message={fehler} /></div> : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <Button variant="ghost" onClick={() => setModus("zu")} disabled={busy}>
              Abbrechen
            </Button>
            <Button variant="accent" onClick={speichern} disabled={busy || !pflichtErfuellt}>
              {busy ? "Speichert …" : "Speichern"}
            </Button>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

function renderInput(
  f: ResourceField,
  werte: Werte,
  setWerte: (fn: (prev: Werte) => Werte) => void,
  disabled: boolean
) {
  const set = (v: string | number | string[]) => setWerte((prev) => ({ ...prev, [f.name]: v }));
  const v = werte[f.name];

  if (f.type === "list") {
    return <ListInput value={Array.isArray(v) ? v : []} onChange={set} />;
  }
  if (f.type === "number") {
    return <NumberInput value={typeof v === "number" ? v : 0} onChange={set} />;
  }
  if (f.type === "select") {
    return <Select value={String(v ?? "")} onChange={set} options={f.options ?? []} disabled={disabled} />;
  }
  if (f.type === "textarea") {
    return <TextArea value={String(v ?? "")} onChange={set} rows={3} />;
  }
  return <TextInput value={String(v ?? "")} onChange={set} disabled={disabled} mono={Boolean(f.pk)} />;
}
