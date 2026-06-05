"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CriterionBand,
  ExamGrade,
  ExaminerResult,
  ExamSimulation,
  ExamTask,
} from "@/types";

const ACCENT = "var(--accent-write)";

type Status = "idle" | "loading" | "done" | "error";

const BAND_COLOR: Record<CriterionBand, string> = {
  A: "var(--ok)",
  B: "var(--ok)",
  C: "var(--accent-write)",
  D: "var(--bad)",
  E: "var(--bad)",
};

function wordCount(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

/** Punkte mit deutschem Dezimalkomma, z.B. 7.5 → "7,5". */
function fmtPunkte(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

export function ExamRunner({ simulations }: { simulations: ExamSimulation[] }) {
  const [simId, setSimId] = useState(simulations[0]?.id ?? 1);
  const sim = useMemo(
    () => simulations.find((s) => s.id === simId) ?? simulations[0],
    [simulations, simId]
  );

  const [taskId, setTaskId] = useState(sim?.tasks[0]?.id ?? "");
  const task: ExamTask | undefined = useMemo(
    () => sim?.tasks.find((t) => t.id === taskId) ?? sim?.tasks[0],
    [sim, taskId]
  );

  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [grade, setGrade] = useState<ExamGrade | null>(null);
  const [examiners, setExaminers] = useState<ExaminerResult[]>([]);
  const [thirdUsed, setThirdUsed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // Fortschritt der Bewertung (gestreamt vom Server).
  const [doneExaminers, setDoneExaminers] = useState<string[]>([]);
  const [thirdActive, setThirdActive] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Nach der Bewertung sanft zum Ergebnis scrollen.
  useEffect(() => {
    if (status === "done" && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [status]);

  function selectSim(id: number) {
    const next = simulations.find((s) => s.id === id);
    setSimId(id);
    setTaskId(next?.tasks[0]?.id ?? "");
    resetAnswer();
  }

  function selectTask(id: string) {
    setTaskId(id);
    resetAnswer();
  }

  function resetAnswer() {
    setText("");
    setStatus("idle");
    setGrade(null);
    setExaminers([]);
    setThirdUsed(false);
    setErrorMsg("");
    setDoneExaminers([]);
    setThirdActive(false);
  }

  async function submit() {
    if (!task) return;
    setStatus("loading");
    setErrorMsg("");
    setGrade(null);
    setDoneExaminers([]);
    setThirdActive(false);
    try {
      const res = await fetch("/api/exam/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, answer: text }),
      });

      // Vorab-Fehler (kein Stream) kommen als JSON mit non-200.
      if (!res.ok || !res.body) {
        let msg = "Die Bewertung ist fehlgeschlagen.";
        try {
          const d = await res.json();
          msg = d?.error ?? msg;
        } catch {
          /* leer */
        }
        setStatus("error");
        setErrorMsg(msg);
        return;
      }

      // NDJSON-Stream mit Fortschritts-Ereignissen lesen.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finished = false;

      const handle = (ev: { type: string; [k: string]: unknown }) => {
        if (ev.type === "examiner" && typeof ev.label === "string") {
          const label = ev.label;
          setDoneExaminers((p) => (p.includes(label) ? p : [...p, label]));
        } else if (ev.type === "third") {
          setThirdActive(true);
        } else if (ev.type === "done") {
          setGrade(ev.grade as ExamGrade);
          setExaminers((ev.examiners as ExaminerResult[]) ?? []);
          setThirdUsed(Boolean(ev.thirdUsed));
          setStatus("done");
          finished = true;
        } else if (ev.type === "error") {
          setStatus("error");
          setErrorMsg(
            (ev.error as string) ??
              "Die Bewertung konnte nicht erstellt werden. Bitte versuche es erneut."
          );
          finished = true;
        }
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            handle(JSON.parse(line));
          } catch {
            /* unvollständige/ungültige Zeile ignorieren */
          }
        }
      }

      if (!finished) {
        setStatus("error");
        setErrorMsg(
          "Die Bewertung wurde unerwartet beendet. Bitte versuche es erneut."
        );
      }
    } catch {
      setStatus("error");
      setErrorMsg("Verbindung fehlgeschlagen. Bitte versuche es erneut.");
    }
  }

  const words = wordCount(text);
  const underTarget = task ? words > 0 && words < task.minWords : false;
  const tooShort = text.trim().length < 20;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-6">
      {/* Simulation (Dropdown) */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="sim-select"
          className="text-xs font-medium text-[var(--fg-dim)]"
        >
          Simulation
        </label>
        <select
          id="sim-select"
          value={simId}
          onChange={(e) => selectSim(Number(e.target.value))}
          className="w-full max-w-xs rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--border)]"
        >
          {simulations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.titleDe}
            </option>
          ))}
        </select>
      </div>

      {/* Aufgaben der Simulation */}
      <div className="mt-4 flex flex-wrap gap-2">
        {sim?.tasks.map((t) => (
          <Chip key={t.id} active={t.id === taskId} onClick={() => selectTask(t.id)}>
            Aufgabe {t.aufgabe}
          </Chip>
        ))}
      </div>

      {task && (
        /* CBT-Layout: links Aufgabe (40 %), rechts Schreibfeld (60 %) — nur Desktop. */
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Aufgabenstellung (links) */}
          <div className="lg:col-span-2">
            <div className="rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4 lg:h-full lg:min-h-[60vh]">
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    color: ACCENT,
                    backgroundColor: `color-mix(in srgb, ${ACCENT} 16%, transparent)`,
                  }}
                >
                  {task.taskType}
                </span>
                <span className="text-xs text-[var(--fg-dim)]">
                  ca. {task.minWords} Wörter
                  {task.recommendedMinutes
                    ? ` · ${task.recommendedMinutes} Min.`
                    : ""}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-[var(--fg)]">
                {task.titleDe}
              </h2>
              <p className="mt-1 whitespace-pre-line text-sm text-[var(--fg-muted)]">
                {task.promptDe}
              </p>
              {task.bulletPointsDe && (
                <ul className="mt-2 flex flex-col gap-1">
                  {task.bulletPointsDe.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-[var(--fg-muted)]"
                    >
                      <span style={{ color: ACCENT }}>•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {task.sampleAnswerDe && (
                <details className="group/sample mt-3 border-t border-[var(--border-soft)] pt-3">
                  <summary
                    className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium outline-none"
                    style={{ color: ACCENT }}
                  >
                    <span className="transition-transform group-open/sample:rotate-90">
                      ›
                    </span>
                    Beispieltext anzeigen
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--fg-muted)]">
                    {task.sampleAnswerDe}
                  </p>
                </details>
              )}
            </div>
          </div>

          {/* Schreibfeld (rechts) — Monospace wie im echten CBT */}
          <div className="flex flex-col lg:col-span-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={status === "loading"}
              placeholder="Schreibe hier deine Antwort …"
              spellCheck={false}
              className="min-h-[260px] w-full resize-y rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-elev)] p-4 font-mono text-[15px] leading-relaxed text-[var(--fg)] outline-none focus:border-[var(--border)] disabled:opacity-60 lg:min-h-[60vh]"
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span
                style={{ color: underTarget ? "var(--bad)" : "var(--fg-dim)" }}
              >
                {words} Wörter
                {underTarget ? ` · Ziel: ca. ${task.minWords}` : ""}
              </span>
              <button
                onClick={submit}
                disabled={status === "loading" || tooShort}
                className="rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: "var(--bg)", backgroundColor: ACCENT }}
              >
                {status === "loading" ? "Wird bewertet …" : "Bewerten lassen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ladezustand — Fortschritt (Vier-Augen-Prinzip) */}
      {status === "loading" && (
        <div
          aria-busy="true"
          className="mt-5 animate-fade-in rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4"
        >
          <div className="text-sm font-medium text-[var(--fg)]">
            Vier-Augen-Prinzip — Bewertung läuft
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            <StepRow state="done" label="Antwort gesendet" />
            <StepRow
              state={doneExaminers.includes("mild") ? "done" : "active"}
              label="Prüfer A · mild bewertet"
            />
            <StepRow
              state={doneExaminers.includes("streng") ? "done" : "active"}
              label="Prüfer B · streng bewertet"
            />
            {thirdActive && (
              <StepRow state="active" label="Drittprüfer entscheidet" />
            )}
            <StepRow
              state={doneExaminers.length >= 2 ? "active" : "pending"}
              label="Ergebnis wird zusammengeführt"
            />
          </ul>
        </div>
      )}

      {/* Fehler */}
      {status === "error" && (
        <div
          className="mt-5 animate-fade-in rounded-[var(--radius)] border p-4 text-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--bad) 50%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--bad) 12%, transparent)",
            color: "var(--fg)",
          }}
        >
          {errorMsg}
          <button
            onClick={submit}
            className="ml-2 underline underline-offset-2"
            style={{ color: "var(--bad)" }}
          >
            erneut versuchen
          </button>
        </div>
      )}

      {/* Ergebnis */}
      {status === "done" && grade && (
        <div ref={resultRef}>
          <GradeResult
            grade={grade}
            examiners={examiners}
            thirdUsed={thirdUsed}
            onReset={resetAnswer}
          />
        </div>
      )}
    </div>
  );
}

function BandChip({ band }: { band: CriterionBand }) {
  return (
    <span
      className="grid h-6 w-6 place-items-center rounded-full text-xs font-semibold"
      style={{
        color: BAND_COLOR[band],
        backgroundColor: `color-mix(in srgb, ${BAND_COLOR[band]} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${BAND_COLOR[band]} 45%, transparent)`,
      }}
    >
      {band}
    </span>
  );
}

function GradeResult({
  grade,
  examiners,
  thirdUsed,
  onReset,
}: {
  grade: ExamGrade;
  examiners: ExaminerResult[];
  thirdUsed: boolean;
  onReset: () => void;
}) {
  const bandOf = (label: string, key: string): CriterionBand | undefined =>
    examiners
      .find((e) => e.label === label)
      ?.grade.criteria.find((c) => c.key === key)?.band;

  return (
    <div className="mt-6 animate-fade-in">
      {/* Kopf: Gesamtpunkte + bestanden */}
      <div className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4">
        <div>
          <div className="text-xs text-[var(--fg-dim)]">
            Gesamtergebnis · Vier-Augen-Prinzip
          </div>
          <div className="text-2xl font-semibold text-[var(--fg)]">
            {fmtPunkte(grade.gesamtpunkte)}
            <span className="text-base font-normal text-[var(--fg-dim)]">
              {" "}
              / {fmtPunkte(grade.maxPunkte)}
            </span>
          </div>
        </div>
        <span
          className="rounded-full px-3 py-1 text-sm font-medium"
          style={{
            color: grade.bestanden ? "var(--ok)" : "var(--bad)",
            backgroundColor: grade.bestanden
              ? "color-mix(in srgb, var(--ok) 16%, transparent)"
              : "color-mix(in srgb, var(--bad) 16%, transparent)",
          }}
        >
          {grade.bestanden ? "bestanden" : "nicht bestanden"}
        </span>
      </div>

      {/* Kriterien (zusammengeführt) */}
      <ul className="mt-3 flex flex-col gap-3">
        {grade.criteria.map((c) => (
          <li
            key={c.key}
            className="rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BandChip band={c.band} />
                <span className="text-sm font-semibold text-[var(--fg)]">
                  {c.labelDe}
                </span>
              </div>
              <span className="text-xs text-[var(--fg-dim)]">
                {fmtPunkte(c.punkte)} / {fmtPunkte(c.maxPunkte)} Punkte
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">
              {c.begruendungDe}
            </p>
          </li>
        ))}
      </ul>

      {/* Vier-Augen-Aufschlüsselung */}
      {examiners.length >= 2 && (
        <details className="group/aug mt-3 rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4">
          <summary
            className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[var(--fg)] outline-none"
          >
            <span
              className="transition-transform group-open/aug:rotate-90"
              style={{ color: ACCENT }}
            >
              ›
            </span>
            4-Augen-Prinzip — die zwei Prüfer im Vergleich
          </summary>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--fg-dim)]">
                  <th className="py-1 pr-3 font-medium">Kriterium</th>
                  <th className="px-2 py-1 text-center font-medium">A · mild</th>
                  <th className="px-2 py-1 text-center font-medium">B · streng</th>
                  {thirdUsed && (
                    <th className="px-2 py-1 text-center font-medium">Konsens</th>
                  )}
                  <th className="px-2 py-1 text-center font-medium">Ø Punkte</th>
                </tr>
              </thead>
              <tbody>
                {grade.criteria.map((c) => {
                  const a = bandOf("mild", c.key);
                  const b = bandOf("streng", c.key);
                  const k = bandOf("konsens", c.key);
                  return (
                    <tr
                      key={c.key}
                      className="border-t border-[var(--border-soft)]"
                    >
                      <td className="py-2 pr-3 text-[var(--fg-muted)]">
                        {c.labelDe}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {a && (
                          <span className="inline-grid place-items-center">
                            <BandChip band={a} />
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {b && (
                          <span className="inline-grid place-items-center">
                            <BandChip band={b} />
                          </span>
                        )}
                      </td>
                      {thirdUsed && (
                        <td className="px-2 py-2 text-center">
                          {k && (
                            <span className="inline-grid place-items-center">
                              <BandChip band={k} />
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-2 text-center text-[var(--fg-muted)]">
                        {fmtPunkte(c.punkte)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[var(--fg-dim)]">
            Wie in der echten Prüfung bewerten zwei Prüfer unabhängig; das
            Endergebnis ist das arithmetische Mittel beider Bewertungen.
            {thirdUsed
              ? " Da sich die beiden über das Bestehen uneinig waren, gab eine Drittbewertung (Prüfer C) den Ausschlag."
              : ""}
          </p>
        </details>
      )}

      {/* Gesamtrückmeldung */}
      <div className="mt-3 rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4">
        <h3 className="text-sm font-semibold text-[var(--fg)]">Rückmeldung</h3>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">{grade.summaryDe}</p>
        {grade.korrekturen && grade.korrekturen.length > 0 && (
          <>
            <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
              Verbesserungsvorschläge
            </h4>
            <ul className="mt-1 flex flex-col gap-1">
              {grade.korrekturen.map((k, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-[var(--fg-muted)]"
                >
                  <span style={{ color: ACCENT }}>→</span>
                  <span>{k}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <button
        onClick={onReset}
        className="mt-4 rounded-full border px-4 py-2 text-sm transition-colors"
        style={{ borderColor: "var(--border-soft)", color: "var(--fg-muted)" }}
      >
        Neue Antwort schreiben
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2"
      style={{ borderColor: "var(--border-soft)", borderTopColor: ACCENT }}
      aria-hidden
    />
  );
}

function StepRow({
  state,
  label,
}: {
  state: "pending" | "active" | "done";
  label: string;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      {state === "done" ? (
        <span
          className="grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold"
          style={{ color: "var(--bg)", backgroundColor: "var(--ok)" }}
        >
          ✓
        </span>
      ) : state === "active" ? (
        <Spinner />
      ) : (
        <span className="h-4 w-4 rounded-full border border-[var(--border-soft)]" />
      )}
      <span
        style={{
          color: state === "pending" ? "var(--fg-dim)" : "var(--fg-muted)",
        }}
      >
        {label}
      </span>
    </li>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-xs transition-colors"
      style={{
        borderColor: active ? "var(--fg)" : "var(--border-soft)",
        color: active ? "var(--bg)" : "var(--fg-muted)",
        backgroundColor: active ? "var(--fg)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}
