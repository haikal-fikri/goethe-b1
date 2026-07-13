"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ExamGrade,
  ExaminerResult,
  ExamSimulation,
  ExamTask,
} from "@/types";
import {
  TurnstileGate,
  turnstileEnabledClient,
  type TurnstileGateHandle,
} from "./TurnstileGate";
import { Card, Num, Pill } from "@/components/ui/primitives";
import { Button, Chip, FieldLabel, INPUT } from "@/components/ui/controls";
import { IconChevronRight } from "@/components/icons";
import { ACCENT, wordCount, type Status } from "./examUi";
import { GradingProgress } from "./GradingProgress";
import { GradeResult } from "./GradeResult";

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
  // Turnstile-Token (Bot-Prüfung) — nur relevant, wenn der Site-Key gesetzt ist.
  const [token, setToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileGateHandle>(null);

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
        body: JSON.stringify({
          taskId: task.id,
          answer: text,
          turnstileToken: token ?? undefined,
        }),
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
    } finally {
      // Turnstile-Tokens sind Einweg — nach jedem Versuch ein frisches holen.
      turnstileRef.current?.reset();
    }
  }

  const words = wordCount(text);
  const underTarget = task ? words > 0 && words < task.minWords : false;
  const tooShort = text.trim().length < 20;
  const submitDisabled =
    status === "loading" || tooShort || (turnstileEnabledClient && !token);

  return (
    <div>
      {/* Simulation (Dropdown) */}
      <div className="max-w-xs">
        <label htmlFor="sim-select">
          <FieldLabel>Simulation</FieldLabel>
        </label>
        <select
          id="sim-select"
          value={simId}
          onChange={(e) => selectSim(Number(e.target.value))}
          className="focus-ring"
          style={{ ...INPUT, height: 42, fontSize: 13.5 }}
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
          <Chip
            key={t.id}
            size="sm"
            active={t.id === taskId}
            onClick={() => selectTask(t.id)}
          >
            Aufgabe <Num>{t.aufgabe}</Num>
          </Chip>
        ))}
      </div>

      {task && (
        /* CBT-Layout: links Aufgabe (40 %), rechts Schreibfeld (60 %) — nur Desktop. */
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Aufgabenstellung (links) */}
          <div className="lg:col-span-2">
            <Card radius={18} style={{ height: "100%" }} className="lg:min-h-[60vh]">
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <Pill tone="gruen">{task.taskType}</Pill>
                <span className="text-xs text-faint">
                  ca. <Num>{task.minWords}</Num> Wörter
                  {task.recommendedMinutes ? (
                    <>
                      {" "}
                      · <Num>{task.recommendedMinutes}</Num> Min.
                    </>
                  ) : null}
                </span>
              </div>
              <h2
                className="font-serif"
                style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-hi)" }}
              >
                {task.titleDe}
              </h2>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted">
                {task.promptDe}
              </p>
              {task.bulletPointsDe && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {task.bulletPointsDe.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted">
                      <span style={{ color: ACCENT }}>•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {task.sampleAnswerDe && (
                <details className="group/sample mt-4 border-t border-line pt-3">
                  <summary
                    className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold outline-none"
                    style={{ color: ACCENT }}
                  >
                    <span className="transition-transform group-open/sample:rotate-90">
                      <IconChevronRight size={14} />
                    </span>
                    Beispieltext anzeigen
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
                    {task.sampleAnswerDe}
                  </p>
                </details>
              )}
            </Card>
          </div>

          {/* Schreibfeld (rechts) — Monospace wie im echten CBT.
              Mono ist hier die EINZIGE sanktionierte Rolle: getippter Prüfungstext. */}
          <div className="flex flex-col lg:col-span-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={status === "loading" || status === "done"}
              placeholder="Schreibe hier deine Antwort …"
              spellCheck={false}
              className="focus-ring min-h-[260px] w-full resize-y rounded-input border border-line bg-surface p-4 font-mono text-[15px] leading-relaxed text-ink outline-none disabled:opacity-60 lg:min-h-[60vh]"
            />
            <TurnstileGate ref={turnstileRef} onToken={setToken} />
            <div className="mt-2.5 flex items-center justify-between gap-3 text-xs">
              <span style={{ color: underTarget ? "var(--rot-text)" : "var(--text-2)" }}>
                <Num>{words}</Num> Wörter
                {underTarget ? (
                  <>
                    {" "}
                    · Ziel: ca. <Num>{task.minWords}</Num>
                  </>
                ) : null}
              </span>
              <Button
                variant="accent"
                onClick={submit}
                disabled={submitDisabled}
                style={{
                  height: 40,
                  opacity: submitDisabled ? 0.4 : 1,
                  cursor: submitDisabled ? "not-allowed" : "pointer",
                }}
              >
                {status === "loading"
                  ? "Wird bewertet …"
                  : !tooShort && turnstileEnabledClient && !token
                    ? "Sicherheitsprüfung …"
                    : "Bewerten lassen"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ladezustand — Fortschritt (Vier-Augen-Prinzip) */}
      {status === "loading" && (
        <GradingProgress doneExaminers={doneExaminers} thirdActive={thirdActive} />
      )}

      {/* Fehler */}
      {status === "error" && (
        <div
          className="mt-5 animate-fade-in rounded-card p-4 text-sm"
          style={{
            border: "1px solid color-mix(in oklab, var(--rot) 45%, transparent)",
            background: "var(--rot-tint)",
            color: "var(--text-1)",
          }}
        >
          {errorMsg}
          <button
            onClick={submit}
            className="ml-2 underline underline-offset-2"
            style={{ color: "var(--rot-text)" }}
          >
            erneut versuchen
          </button>
        </div>
      )}

      {/* Ergebnis */}
      {status === "done" && grade && task && (
        <div ref={resultRef}>
          <GradeResult
            grade={grade}
            examiners={examiners}
            thirdUsed={thirdUsed}
            task={task}
            essay={text}
            onReset={resetAnswer}
          />
        </div>
      )}
    </div>
  );
}
