"use client";

import { useMemo, useState } from "react";
import type {
  CriterionBand,
  ExamGrade,
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
  const [errorMsg, setErrorMsg] = useState("");

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
    setErrorMsg("");
  }

  async function submit() {
    if (!task) return;
    setStatus("loading");
    setErrorMsg("");
    setGrade(null);
    try {
      const res = await fetch("/api/exam/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, answer: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data?.error ?? "Die Bewertung ist fehlgeschlagen.");
        return;
      }
      setGrade(data.grade as ExamGrade);
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMsg("Verbindung fehlgeschlagen. Bitte versuche es erneut.");
    }
  }

  const words = wordCount(text);
  const underTarget = task ? words > 0 && words < task.minWords : false;
  const tooShort = text.trim().length < 20;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
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
        <>
          {/* Aufgabenstellung */}
          <div className="mt-5 rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4">
            <div className="mb-1 flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
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
            <p className="mt-1 text-sm text-[var(--fg-muted)]">{task.promptDe}</p>
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

          {/* Schreibfeld */}
          <div className="mt-4 flex flex-col">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={status === "loading"}
              placeholder="Schreibe hier deine Antwort …"
              className="min-h-[240px] flex-1 resize-y rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-elev)] p-4 text-[16px] leading-relaxed text-[var(--fg)] outline-none focus:border-[var(--border)] disabled:opacity-60 sm:text-[15px]"
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span
                style={{
                  color: underTarget ? "var(--bad)" : "var(--fg-dim)",
                }}
              >
                {words} Wörter
                {underTarget ? ` · Ziel: ca. ${task.minWords}` : ""}
              </span>
              <button
                onClick={submit}
                disabled={status === "loading" || tooShort}
                className="rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  color: "var(--bg)",
                  backgroundColor: ACCENT,
                }}
              >
                {status === "loading" ? "Wird bewertet …" : "Bewerten lassen"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Ladezustand */}
      {status === "loading" && (
        <div
          aria-busy="true"
          className="mt-5 animate-fade-in rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4 text-sm text-[var(--fg-muted)]"
        >
          Dein Text wird von der KI-Prüferin bewertet …
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
        <GradeResult grade={grade} onReset={resetAnswer} />
      )}
    </div>
  );
}

function GradeResult({
  grade,
  onReset,
}: {
  grade: ExamGrade;
  onReset: () => void;
}) {
  return (
    <div className="mt-6 animate-fade-in">
      {/* Kopf: Gesamtpunkte + bestanden */}
      <div className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4">
        <div>
          <div className="text-xs text-[var(--fg-dim)]">Gesamtergebnis</div>
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

      {/* Kriterien */}
      <ul className="mt-3 flex flex-col gap-3">
        {grade.criteria.map((c) => (
          <li
            key={c.key}
            className="rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="grid h-7 w-7 place-items-center rounded-full text-sm font-semibold"
                  style={{
                    color: BAND_COLOR[c.band],
                    backgroundColor: `color-mix(in srgb, ${BAND_COLOR[c.band]} 16%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${BAND_COLOR[c.band]} 45%, transparent)`,
                  }}
                >
                  {c.band}
                </span>
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
        style={{
          borderColor: "var(--border-soft)",
          color: "var(--fg-muted)",
        }}
      >
        Neue Antwort schreiben
      </button>
    </div>
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
