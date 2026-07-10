"use client";
import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  createWritingCustomAssignment,
  createWritingCorpusAssignment,
  createSpeakingAssignment,
} from "@/lib/data/assignments";
import { Segmented } from "@/components/ui/controls";
import { IconPencil, IconMic } from "@/components/icons";

// Client-Formular „Neue Aufgabe" (client-direkter RLS-Insert über die DAL).
// Quellen: Korpus (exam_task, public read) ODER frei formuliert; plus Sprechen.
// Bei kind='writing' erzwingt assignments_writing_source_ck GENAU EINE Quelle.

export interface KlasseOpt {
  id: string;
  name: string;
}
export interface KorpusTask {
  id: string;
  aufgabe: number;
  taskType: string;
  titleDe: string;
  minWords: number;
  recommendedMinutes: number | null;
}
export interface KorpusSim {
  id: number;
  titleDe: string;
  tasks: KorpusTask[];
}

type Skill = "schreiben" | "sprechen";
type Source = "korpus" | "custom";

const LABEL: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--text-2)",
  marginBottom: 8,
};
const CARD: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-1)",
  borderRadius: 16,
  boxShadow: "var(--shadow-card-now)",
  padding: 20,
  marginBottom: 18,
};
const INPUT: CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "1px solid var(--border-1)",
  background: "var(--bg)",
  padding: "0 14px",
  fontSize: 14,
  color: "var(--text-hi)",
  outline: "none",
};
const TEXTAREA: CSSProperties = {
  width: "100%",
  minHeight: 78,
  resize: "vertical",
  borderRadius: 12,
  border: "1px solid var(--border-1)",
  background: "var(--bg)",
  padding: "12px 14px",
  fontSize: 13.5,
  lineHeight: 1.6,
  color: "var(--text-hi)",
  outline: "none",
  fontFamily: "var(--font-ui)",
};

export function NeueAufgabeForm({ classes, simulations }: { classes: KlasseOpt[]; simulations: KorpusSim[] }) {
  const router = useRouter();
  const hasKorpus = simulations.length > 0;

  const [skill, setSkill] = useState<Skill>("schreiben");
  const [source, setSource] = useState<Source>(hasKorpus ? "korpus" : "custom");
  const [classId, setClassId] = useState<string>(classes[0]?.id ?? "");
  const [dueDate, setDueDate] = useState<string>("");

  // Korpus
  const [simId, setSimId] = useState<number>(simulations[0]?.id ?? 0);
  const currentSim = useMemo(() => simulations.find((s) => s.id === simId) ?? simulations[0], [simulations, simId]);
  const [taskId, setTaskId] = useState<string>(simulations[0]?.tasks[0]?.id ?? "");

  // Frei formuliert (Schreiben)
  const [title, setTitle] = useState("");
  const [promptDe, setPromptDe] = useState("");
  const [bulletsText, setBulletsText] = useState("");
  const [minWords, setMinWords] = useState("80");
  const [recMinutes, setRecMinutes] = useState("20");

  // Sprechen
  const [thema, setThema] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function selectSim(id: number) {
    setSimId(id);
    const sim = simulations.find((s) => s.id === id);
    setTaskId(sim?.tasks[0]?.id ?? "");
  }

  function dueAtIso(): string | null {
    if (!dueDate) return null;
    const d = new Date(`${dueDate}T23:59:59`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  async function submit() {
    setErr(null);
    if (!classId) {
      setErr("Bitte wählen Sie eine Zielklasse.");
      return;
    }
    const sb = supabaseBrowser();
    const due_at = dueAtIso();
    setBusy(true);
    try {
      let error: { message: string } | null = null;

      if (skill === "sprechen") {
        if (!thema.trim()) throw new Error("Bitte geben Sie ein Thema an.");
        // In speaking_assignments schreiben (nicht assignments) — nur diese
        // Tabelle speist die Sprech-Einreichung + -Bewertung. Teil 2 =
        // Präsentation (siehe Formular-Hinweis).
        ({ error } = await createSpeakingAssignment(sb, {
          class_id: classId,
          teil: 2,
          prompt_de: thema.trim(),
          due_at,
        }));
      } else if (source === "korpus") {
        const task = currentSim?.tasks.find((t) => t.id === taskId);
        if (!task) throw new Error("Bitte wählen Sie eine Aufgabe aus dem Korpus.");
        ({ error } = await createWritingCorpusAssignment(sb, {
          class_id: classId,
          title: task.titleDe || task.taskType,
          task_id: task.id,
          simulation_id: currentSim?.id ?? null,
          due_at,
          recommended_minutes: task.recommendedMinutes ?? null,
        }));
      } else {
        if (!title.trim()) throw new Error("Bitte geben Sie einen Titel an.");
        if (!promptDe.trim()) throw new Error("Bitte geben Sie eine Aufgabenstellung an.");
        const mw = parseInt(minWords, 10);
        if (Number.isNaN(mw) || mw < 20 || mw > 2000) throw new Error("Mindestwörter müssen zwischen 20 und 2000 liegen.");
        const rec = parseInt(recMinutes, 10);
        ({ error } = await createWritingCustomAssignment(sb, {
          class_id: classId,
          title: title.trim(),
          prompt_de: promptDe.trim(),
          bullet_points_de: bulletsText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
          min_words: mw,
          due_at,
          recommended_minutes: Number.isNaN(rec) ? null : rec,
        }));
      }

      if (error) throw new Error(error.message);
      router.push("/aufgaben");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Die Aufgabe konnte nicht erstellt werden.");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 26, alignItems: "start" }}>
      {/* Linke Spalte */}
      <div>
        <div style={LABEL}>Art der Aufgabe</div>
        <Segmented<Skill>
          value={skill}
          onChange={setSkill}
          style={{ marginBottom: 22 }}
          options={[
            { value: "schreiben", label: (<><IconPencil size={16} />Schreiben</>) },
            { value: "sprechen", label: (<><IconMic size={16} />Sprechen</>) },
          ]}
        />

        {skill === "schreiben" ? (
          <>
            <div style={LABEL}>Quelle</div>
            <Segmented<Source>
              value={source}
              onChange={setSource}
              style={{ marginBottom: 22 }}
              options={[
                { value: "korpus", label: "Aus dem Korpus" },
                { value: "custom", label: "Eigene Aufgabe" },
              ]}
            />

            {source === "korpus" ? (
              hasKorpus ? (
                <div style={CARD}>
                  <div style={LABEL}>Prüfungssimulation</div>
                  <select
                    className="focus-ring"
                    value={simId}
                    onChange={(e) => selectSim(Number(e.target.value))}
                    style={{ ...INPUT, height: 46, marginBottom: 16, cursor: "pointer" }}
                  >
                    {simulations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.titleDe}
                      </option>
                    ))}
                  </select>
                  <div style={LABEL}>Aufgabe</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(currentSim?.tasks ?? []).map((t) => {
                      const active = t.id === taskId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTaskId(t.id)}
                          className="press"
                          style={{
                            flex: "1 1 120px",
                            textAlign: "center",
                            padding: "10px 8px",
                            borderRadius: 10,
                            border: active ? "1.5px solid var(--gruen)" : "1px solid var(--border-1)",
                            background: active ? "var(--gruen-tint)" : "var(--bg)",
                            color: active ? "var(--gruen)" : "var(--text-2)",
                            fontSize: 13.5,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <div>Aufgabe {t.aufgabe}</div>
                          <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, opacity: 0.85 }}>{t.taskType}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ ...CARD, textAlign: "center", color: "var(--text-2)", fontSize: 13.5, lineHeight: 1.6 }}>
                  Derzeit sind keine Prüfungssimulationen im Korpus verfügbar. Bitte formulieren Sie die Aufgabe frei.
                </div>
              )
            ) : (
              <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={LABEL}>Titel</div>
                  <input
                    className="focus-ring"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="z. B. Informelle E-Mail — Einladung"
                    style={INPUT}
                  />
                </div>
                <div>
                  <div style={LABEL}>Aufgabenstellung</div>
                  <textarea
                    className="focus-ring"
                    value={promptDe}
                    onChange={(e) => setPromptDe(e.target.value)}
                    placeholder="Beschreiben Sie die Schreibaufgabe…"
                    style={TEXTAREA}
                  />
                </div>
                <div>
                  <div style={LABEL}>Leitpunkte (je Zeile einer)</div>
                  <textarea
                    className="focus-ring"
                    value={bulletsText}
                    onChange={(e) => setBulletsText(e.target.value)}
                    placeholder={"Grund nennen\nDatum angeben\num Antwort bitten"}
                    style={{ ...TEXTAREA, minHeight: 70 }}
                  />
                </div>
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={LABEL}>Mindestwörter</div>
                    <input
                      className="focus-ring"
                      inputMode="numeric"
                      value={minWords}
                      onChange={(e) => setMinWords(e.target.value)}
                      style={{ ...INPUT, fontFamily: "var(--font-serif)" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={LABEL}>Empf. Minuten</div>
                    <input
                      className="focus-ring"
                      inputMode="numeric"
                      value={recMinutes}
                      onChange={(e) => setRecMinutes(e.target.value)}
                      style={{ ...INPUT, fontFamily: "var(--font-serif)" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={CARD}>
            <div style={LABEL}>Thema (Aufgabenstellung)</div>
            <input
              className="focus-ring"
              value={thema}
              onChange={(e) => setThema(e.target.value)}
              placeholder="z. B. Präsentieren Sie das Thema „Reisen“"
              style={{ ...INPUT, marginBottom: 8 }}
            />
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
              Teilnehmende nehmen eine ca. 3-minütige Präsentation auf. Die Aussprache wird anschließend manuell bewertet.
            </p>
          </div>
        )}
      </div>

      {/* Rechte Spalte — Veröffentlichung */}
      <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 18, boxShadow: "var(--shadow-card-now)", padding: 20, position: "sticky", top: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...LABEL, marginBottom: 0 }}>Veröffentlichung</div>
        <div>
          <div style={LABEL}>Fällig am</div>
          <input className="focus-ring" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={INPUT} />
        </div>
        <div>
          <div style={LABEL}>Zielklasse</div>
          {classes.length > 0 ? (
            <select className="focus-ring" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ ...INPUT, cursor: "pointer" }}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
              Keine aktive Klasse. Legen Sie zuerst eine Klasse an.
            </div>
          )}
        </div>

        {err ? (
          <div style={{ fontSize: 13, color: "var(--rot-text)", background: "var(--rot-tint)", borderRadius: 11, padding: "10px 12px", lineHeight: 1.5 }}>
            {err}
          </div>
        ) : null}

        <div style={{ height: 1, background: "var(--border-1)", margin: "2px 0" }} />
        <button
          type="button"
          onClick={submit}
          disabled={busy || classes.length === 0}
          className="btn-accent press"
          style={{
            width: "100%",
            height: 48,
            borderRadius: 13,
            border: "none",
            background: "var(--gruen)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: busy || classes.length === 0 ? "default" : "pointer",
            boxShadow: "var(--glow-gruen)",
            opacity: busy || classes.length === 0 ? 0.6 : 1,
          }}
        >
          {busy ? "Wird erstellt…" : "Aufgabe erstellen & zuweisen"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/aufgaben")}
          disabled={busy}
          className="hover-strong press"
          style={{
            width: "100%",
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
      </div>
    </div>
  );
}
